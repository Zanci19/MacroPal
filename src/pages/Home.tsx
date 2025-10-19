import React, { useEffect, useState } from "react";
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from "@ionic/react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { useHistory } from "react-router";
import { doc, getDoc } from "firebase/firestore";

const Home: React.FC = () => {
  const history = useHistory();
  const [profile, setProfile] = useState<any>(null);
  const [caloriesNeeded, setCaloriesNeeded] = useState<number | null>(null);
  const [macros, setMacros] = useState<{ protein: number; carbs: number; fats: number } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        history.push("/login");
      } else {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        // Redirect new users to setup
        if (!userDoc.exists() || !userDoc.data()?.age) {
          history.push("/setup-profile");
        } else {
          const data = userDoc.data();
          setProfile(data);

          const { age, weight, height, gender, goal, activity } = data;

          // === BMR Calculation (Mifflin-St Jeor) ===
          let bmr = gender === "male"
            ? 10 * weight + 6.25 * height - 5 * age + 5
            : 10 * weight + 6.25 * height - 5 * age - 161;

          // === Activity Multiplier ===
          let activityMultiplier = 1.2;
          switch (activity) {
            case "light": activityMultiplier = 1.375; break;
            case "moderate": activityMultiplier = 1.55; break;
            case "very": activityMultiplier = 1.725; break;
            case "extra": activityMultiplier = 1.9; break;
          }

          let dailyCalories = bmr * activityMultiplier;

          // === Adjust for Goal ===
          if (goal === "lose") dailyCalories -= 500;
          else if (goal === "gain") dailyCalories += 500;

          dailyCalories = Math.round(dailyCalories);
          setCaloriesNeeded(dailyCalories);

          // === Macro Calculation ===
          let proteinPerKg = goal === "lose" ? 2.2 : goal === "gain" ? 2.0 : 1.8;
          let protein = weight * proteinPerKg;
          let proteinCalories = protein * 4;

          let fatCalories = dailyCalories * 0.25;
          let fats = fatCalories / 9;

          let carbsCalories = dailyCalories - (proteinCalories + fatCalories);
          let carbs = carbsCalories / 4;

          setMacros({
            protein: Math.round(protein),
            carbs: Math.round(carbs),
            fats: Math.round(fats),
          });
        }
      }
    });

    return unsubscribe;
  }, [history]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      history.push("/login");
    } catch (error: any) {
      alert("Error logging out: " + error.message);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Home</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding ion-text-center">
        <h2>Welcome back 👋</h2>
        <p>You are logged in as: <strong>{auth.currentUser?.email}</strong></p>

        {profile ? (
          <>
            <h3>Your Profile</h3>
            <p>Age: {profile.age} years</p>
            <p>Weight: {profile.weight} kg</p>
            <p>Height: {profile.height} cm</p>
            <p>Gender: <strong>{profile.gender}</strong></p>
            <p>Activity Level: <strong>{profile.activity}</strong></p>
            <p>Goal: <strong>{profile.goal}</strong></p>

            <h3>Daily Nutrition Targets</h3>
            <p><strong>Calories:</strong> {caloriesNeeded} kcal</p>
            {macros && (
              <>
                <p><strong>Protein:</strong> {macros.protein} g</p>
                <p><strong>Carbs:</strong> {macros.carbs} g</p>
                <p><strong>Fats:</strong> {macros.fats} g</p>
              </>
            )}
          </>
        ) : (
          <p>Loading your profile...</p>
        )}

        <IonButton expand="full" color="primary" onClick={() => history.push("/add-food")}>
          Add Food
        </IonButton>

        <IonButton expand="full" color="danger" onClick={handleLogout}>
          Log Out
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Home;
