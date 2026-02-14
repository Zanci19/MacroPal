/**
 * Patch for @capacitor/camera web implementation
 * 
 * Issue: The Camera plugin sets facingMode property before appending the
 * pwa-camera-modal element to the DOM, which causes Stencil's internal
 * $instanceValues$ to be undefined, resulting in:
 * "TypeError: Cannot read properties of undefined (reading '$instanceValues$')"
 * 
 * Solution: Override property setters on pwa-camera-modal prototype to queue
 * property sets until the component is connected and initialized.
 */

// Wait for custom elements to be defined
const patchCameraModal = () => {
  const cameraModalConstructor = customElements.get('pwa-camera-modal');
  
  if (cameraModalConstructor) {
    const originalPrototype = cameraModalConstructor.prototype;
    
    // Store the original property descriptor if it exists
    const facingModeDescriptor = Object.getOwnPropertyDescriptor(originalPrototype, 'facingMode');
    
    // Create a new property descriptor that handles early sets
    Object.defineProperty(originalPrototype, 'facingMode', {
      get() {
        // If instance is initialized, use original getter
        if ((this as any).$instanceValues$ !== undefined) {
          return facingModeDescriptor?.get?.call(this) ?? (this as any)._facingMode;
        }
        // Otherwise return pending value
        return (this as any)._pendingFacingMode ?? 'user';
      },
      set(value: string) {
        // If instance is initialized, use original setter
        if ((this as any).$instanceValues$ !== undefined) {
          if (facingModeDescriptor?.set) {
            facingModeDescriptor.set.call(this, value);
          } else {
            (this as any)._facingMode = value;
          }
        } else {
          // Store for later when component is connected
          (this as any)._pendingFacingMode = value;
          
          // Set it when component is ready
          if ((this as any).componentOnReady) {
            (this as any).componentOnReady().then(() => {
              if ((this as any)._pendingFacingMode !== undefined) {
                const pendingValue = (this as any)._pendingFacingMode;
                delete (this as any)._pendingFacingMode;
                
                // Now set it properly
                if (facingModeDescriptor?.set) {
                  facingModeDescriptor.set.call(this, pendingValue);
                } else if ((this as any).$instanceValues$ !== undefined) {
                  (this as any)._facingMode = pendingValue;
                  // Trigger re-render if needed
                  if (typeof (this as any).forceUpdate === 'function') {
                    (this as any).forceUpdate();
                  }
                }
              }
            }).catch((err: Error) => {
              console.error('[Camera Patch] Error applying pending facingMode:', err);
            });
          }
        }
      },
      enumerable: true,
      configurable: true,
    });
    
    console.log('[Capacitor Camera Patch] Successfully patched pwa-camera-modal.facingMode property');
    return true;
  }
  
  return false;
};

// Try to patch immediately if element is already defined
if (!patchCameraModal()) {
  // Otherwise wait for it to be defined
  if (window.customElements && typeof window.customElements.whenDefined === 'function') {
    window.customElements.whenDefined('pwa-camera-modal').then(() => {
      patchCameraModal();
    }).catch((err) => {
      console.error('[Capacitor Camera Patch] Error waiting for pwa-camera-modal:', err);
    });
  }
}

// Export for module system
export { patchCameraModal };
