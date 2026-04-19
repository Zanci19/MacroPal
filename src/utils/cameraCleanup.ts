type CameraModalElement = HTMLElement & {
  dismiss?: () => Promise<void> | void;
};

function stopTracksFromMediaElement(mediaElement: HTMLMediaElement): number {
  const srcObject = mediaElement.srcObject;
  if (!(srcObject instanceof MediaStream)) {
    return 0;
  }

  const tracks = srcObject.getTracks();
  tracks.forEach((track) => track.stop());
  mediaElement.srcObject = null;
  return tracks.length;
}

function stopTracksInRoot(root: ParentNode): number {
  let stoppedTrackCount = 0;
  const mediaElements = root.querySelectorAll<HTMLMediaElement>('video, audio');
  mediaElements.forEach((mediaElement) => {
    stoppedTrackCount += stopTracksFromMediaElement(mediaElement);
  });
  return stoppedTrackCount;
}

function stopTracksInElementTree(host: Element): number {
  let stoppedTrackCount = 0;
  stoppedTrackCount += stopTracksInRoot(host);

  const descendants = [host, ...Array.from(host.querySelectorAll('*'))];
  descendants.forEach((node) => {
    const element = node as HTMLElement;
    if (element.shadowRoot) {
      stoppedTrackCount += stopTracksInRoot(element.shadowRoot);
    }
  });

  return stoppedTrackCount;
}

export function cleanupStalePwaCameraModal(): number {
  if (typeof document === 'undefined') {
    return 0;
  }

  let stoppedTrackCount = 0;
  const cameraHosts = Array.from(
    document.querySelectorAll<HTMLElement>('pwa-camera-modal, pwa-camera-modal-instance, pwa-camera')
  );

  cameraHosts.forEach((host) => {
    stoppedTrackCount += stopTracksInElementTree(host);
  });

  const modals = document.querySelectorAll<CameraModalElement>('pwa-camera-modal');
  modals.forEach((modal) => {
    if (typeof modal.dismiss === 'function') {
      void Promise.resolve(modal.dismiss()).catch(() => undefined);
    }
    if (modal.isConnected) {
      modal.remove();
    }
  });

  const instances = document.querySelectorAll<HTMLElement>('pwa-camera-modal-instance');
  instances.forEach((instance) => {
    if (instance.isConnected) {
      instance.remove();
    }
  });

  return stoppedTrackCount;
}
