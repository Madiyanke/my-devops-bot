# Guide de mise en route — DevOps Mentor

Ce guide liste **tout ce que tu dois faire toi-même** pour que l'application fonctionne : clé d'IA, lancement, installation sur téléphone et dépannage.

---

## ✅ Checklist express

1. [ ] Créer une clé **Gemini** gratuite (étape 1).
2. [ ] La brancher : dans l'interface **ou** côté serveur (étape 2).
3. [ ] Lancer l'application (étape 4).
4. [ ] Poser une question test et vérifier que les 4 étapes du pipeline passent au vert.
5. [ ] (Optionnel) Ajouter une clé **Tavily** pour une recherche encore plus fiable (étape 3).
6. [ ] (Optionnel) Installer l'app sur ton téléphone. Cela nécessite une adresse **HTTPS** (étape 5).

---

## 1. Obtenir une clé Gemini (gratuite)

1. Va sur **https://aistudio.google.com/apikey** et connecte-toi avec ton compte Google.
2. Clique sur **Create API key** et choisis ou crée un projet.
3. Copie la clé : elle commence par `AIza…`.

> L'offre gratuite de Gemini a des limites de requêtes par minute et par jour. Chaque question consomme **2 appels** (planification + réponse). Si tu vois « Quota ou limite de débit atteint », attends une minute ou passe à un autre modèle.
> Ne publie jamais ta clé (Git, capture d'écran, message).

**Autres fournisseurs possibles.** L'application reconnaît la plupart des clés automatiquement :

| Fournisseur | Préfixe de la clé | Où l'obtenir |
|---|---|---|
| Google Gemini | `AIza…` | aistudio.google.com/apikey |
| OpenAI | `sk-…` | platform.openai.com/api-keys (nécessite des crédits) |
| Anthropic Claude | `sk-ant-…` | console.anthropic.com |
| Groq (gratuit, très rapide) | `gsk_…` | console.groq.com/keys |
| OpenRouter | `sk-or-…` | openrouter.ai/keys |
| Mistral | sans préfixe : choisir « Mistral AI » | console.mistral.ai |
| Ollama (local, gratuit) | aucune clé | ollama.com |

---

## 2. Brancher la clé

### Option A : dans l'interface (le plus simple)
1. Ouvre l'application, puis clique sur **⚙** (en bas de la barre latérale ou sur la pastille du modèle en haut à droite).
2. Choisis **Ma propre clé** et colle ta clé. Le fournisseur est détecté automatiquement.
3. (Optionnel) Clique sur **Lister** pour voir les modèles disponibles, et choisis-en un.
4. Clique sur **Tester la connexion** : un message vert doit apparaître.

La clé reste dans **ce navigateur**. Sur un autre appareil, il faudra la saisir à nouveau.

### Option B : côté serveur (pour tous les appareils)

**Kubernetes (kind)** : édite `D:\Projets\2026_Learning\kubernetes\base\.env` :
```dotenv
GEMINI_API_KEY=AIzaTaCle
```
⚠️ **Sans guillemets et sans espaces** : Kustomize garde les guillemets dans la valeur, et la clé serait refusée.
Puis applique :
```powershell
cd D:\Projets\2026_Learning\kubernetes\base
kubectl apply -k .
kubectl rollout restart deploy/tutor-devops-api-deployment -n dev
```
Tu peux supprimer la ligne `OPEN_AI_KEY=…` : ce compte OpenAI n'a plus de crédits. Si les deux clés sont présentes, Gemini est utilisé en priorité.

**Docker Compose** : crée un fichier `.env` à la racine du projet :
```dotenv
GEMINI_API_KEY=AIzaTaCle
```

**Vérifier** : dans les logs de l'API, tu dois voir `IA serveur : Google Gemini (gemini-flash-latest)`.
```powershell
kubectl logs deploy/tutor-devops-api-deployment -n dev | Select-String Bootstrap
```

---

## 3. (Optionnel) Rendre la recherche plus robuste

Par défaut, la recherche utilise DuckDuckGo, Wikipedia et Stack Overflow, **sans clé**. DuckDuckGo peut parfois bloquer les requêtes automatiques. Ajoute un moteur conçu pour les applications :

| Variable | Offre gratuite | Inscription |
|---|---|---|
| `TAVILY_API_KEY` | 1 000 recherches/mois, recommandé | https://app.tavily.com |
| `BRAVE_API_KEY` | quota gratuit mensuel | https://api-dashboard.search.brave.com |

Ajoute la ligne dans le même `.env` que la clé Gemini, puis refais `kubectl apply -k .` et le `rollout restart`.
Les moteurs actifs sont affichés dans **⚙ → Moteurs de recherche actifs**.

---

## 4. Lancer l'application

### A. Développement (rechargement à chaud)
```powershell
# Terminal 1 : API
cd devops-tutor
npm ci
$env:GEMINI_API_KEY="AIzaTaCle"; npm run start:dev

# Terminal 2 : interface
cd frontend-tutor
npm ci
$env:VITE_API_URL="http://localhost:3000"; npm run dev
```
Ouvre l'URL affichée par Vite (http://localhost:5173).
Le mode PWA (service worker) n'est actif qu'en build de production, voir B ou C.

### B. Docker Compose
```powershell
docker compose up --build
```
Ouvre http://localhost:8280

### C. Kubernetes local (kind) — ton installation actuelle
```powershell
cd D:\Projets\2026_Personal_Projects\my-devops-bot
docker build -t madiyanke/devops-tutor-api:local devops-tutor
docker build -t madiyanke/devops-tutor-web:local frontend-tutor
kind load docker-image madiyanke/devops-tutor-api:local madiyanke/devops-tutor-web:local --name k8s101

cd D:\Projets\2026_Learning\kubernetes\base
kubectl apply -k .
kubectl rollout restart deploy -n dev
kubectl rollout status deploy/tutor-devops-web-deployment -n dev

kubectl port-forward -n dev svc/web 8080:80
```
Ouvre http://localhost:8080 et **garde le terminal du port-forward ouvert**.
Après chaque redéploiement des pods `web`, le port-forward s'arrête : relance la dernière commande.

---

## 5. Installer l'application (PWA)

> **Règle importante** : un navigateur n'accepte d'installer une PWA que si elle est servie en **HTTPS**, ou sur `localhost` depuis la même machine.
> Sur ton PC, `http://localhost:8080` suffit. Sur ton **téléphone**, il faut une adresse HTTPS.

### Sur ordinateur (Chrome / Edge)
- Clique sur **Installer l'application** en bas de la barre latérale, ou sur l'icône d'installation dans la barre d'adresse.
- L'app s'ouvre dans sa propre fenêtre et apparaît dans le menu Démarrer.

### Sur téléphone : obtenir une adresse HTTPS
**Solution rapide pour tester (tunnel Cloudflare, gratuit, sans compte)** :
```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:8080
```
La commande affiche une adresse du type `https://xxxx.trycloudflare.com` : ouvre-la sur ton téléphone.
⚠️ Cette adresse est **publique** tant que le tunnel tourne. Si une clé est configurée côté serveur, toute personne qui a le lien peut consommer ton quota. Coupe le tunnel (Ctrl+C) après tes tests.

**Solution durable** : déployer l'application sur ton VPS derrière un nom de domaine en HTTPS. Voir [DEPLOY.md](DEPLOY.md).

### Android (Chrome)
1. Ouvre l'adresse HTTPS.
2. Appuie sur **Installer l'application** dans le menu latéral (☰), ou sur la bannière proposée par Chrome, ou sur **⋮ → Installer l'application**.

### iPhone / iPad (Safari uniquement)
1. Ouvre l'adresse HTTPS dans **Safari**.
2. Appuie sur **Partager** (carré avec une flèche) puis **Sur l'écran d'accueil**, puis **Ajouter**.

L'application affiche ce rappel dans le menu latéral sur iPhone.

### Ce que fait la PWA
- **Hors ligne** : l'interface et l'historique restent accessibles, et un bandeau orange l'indique. Poser une question nécessite Internet (recherche + IA).
- **Mises à jour** : quand une nouvelle version est déployée, une notification **« Mettre à jour »** apparaît. Elle ne s'applique jamais pendant une réponse en cours.
- **Raccourci** : un appui long sur l'icône de l'app propose « Nouvelle question ».

---

## 6. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| « Aucune IA configurée » | Pas de clé côté serveur ni dans le navigateur | Étape 2 |
| « Clé API refusée » | Clé invalide, révoquée, ou avec des guillemets dans `.env` | Vérifie la clé ; retire les guillemets ; `kubectl apply -k .` + `rollout restart` |
| `Incorrect API key provided: ${…}` | Variable non substituée dans un YAML | Ne jamais écrire `${VAR}` dans un manifest : utiliser `.env` + Kustomize |
| « Quota ou limite de débit atteint » | Quota gratuit dépassé, ou plus de crédits | Attendre, changer de modèle, ou utiliser une autre clé (Groq est gratuit) |
| « Modèle introuvable » | Nom de modèle inexistant pour ce fournisseur | ⚙ → **Lister** → choisir un modèle de la liste |
| « Fournisseur non reconnu » | Clé sans préfixe connu (Mistral…) | Choisir le fournisseur dans la liste |
| Ollama : « URL personnalisées désactivées » | Sécurité côté serveur | `ALLOW_CUSTOM_BASE_URL=true` (déjà activé dans kind et Compose). L'URL doit être joignable **depuis le conteneur API** : `http://host.docker.internal:11434/v1` avec Docker Compose |
| Étape **Recherche** en rouge | DuckDuckGo bloque temporairement | Réessayer, ou ajouter `TAVILY_API_KEY` (étape 3) |
| « Impossible de joindre le backend » | Pods API arrêtés ou port-forward coupé | `kubectl get pods -n dev`, puis relancer le port-forward |
| Page blanche / ancienne version | Ancienne version gardée en cache par le service worker | Cliquer « Mettre à jour », ou fermer **tous** les onglets de l'app puis rouvrir |
| Pas de bouton « Installer » | Page servie en HTTP sur une autre machine que `localhost` | Utiliser une adresse HTTPS (étape 5) |
| Animations absentes | Option « réduire les animations » activée sur l'appareil | Comportement voulu (accessibilité) |

**Commandes utiles**
```powershell
kubectl get pods -n dev                                   # état des pods
kubectl logs deploy/tutor-devops-api-deployment -n dev    # logs de l'API (erreurs IA, recherche)
curl http://localhost:8080/api/health                     # l'API répond-elle ?
curl http://localhost:8080/api/tutor/config               # IA et moteurs actifs côté serveur
```
