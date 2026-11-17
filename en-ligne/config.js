/* R·Vision en ligne — configuration Firebase
   ─────────────────────────────────────────
   Tant que la valeur ci-dessous reste « null », le mode en ligne est éteint : les pages fonctionnent exactement
   comme avant, rien n'est chargé, rien n'est envoyé.

   Pour l'allumer (voir LISEZMOI-EN-LIGNE.txt, étape 3) : remplace « null » par l'objet firebaseConfig que donne
   la console Firebase, par exemple :

   export default {
     apiKey: "AIza…",
     authDomain: "rvision-xxxx.firebaseapp.com",
     projectId: "rvision-xxxx",
     storageBucket: "rvision-xxxx.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };

   Ces valeurs ne sont pas secrètes (elles identifient le projet, elles n'y donnent aucun droit) : ce sont les
   règles de sécurité (firestore.rules) qui protègent les données. On peut donc les publier sur GitHub. */
export default null;
