# DevOps Tutor AI 🤖

[![CI/CD Pipeline](https://github.com/YOUR_USERNAME/my-devops-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/my-devops-bot/actions/workflows/ci.yml)

Un chatbot AI moderne pour l'apprentissage DevOps, alimenté par OpenAI, avec une interface utilisateur premium.

## 🚀 Fonctionnalités

- **Chat AI Intelligent** : Questions-Réponses sur Docker, Kubernetes, CI/CD
- **Interface Moderne** : Design gradients avec glassmorphism
- **Architecture Microservices** : Backend NestJS + Frontend Vue.js
- **CI/CD Automatisé** : GitHub Actions avec tests automatiques
- **Containerisé** : Docker & Docker Compose

## 🛠️ Stack Technique

### Backend
- **Framework** : NestJS (Node.js)
- **AI** : OpenAI GPT
- **Tests** : Jest
- **Linting** : ESLint

### Frontend
- **Framework** : Vue.js 3 + Vite
- **Style** : CSS (Gradients, Glassmorphism)
- **Tests** : Vitest
- **Linting** : ESLint + Vue plugin

### DevOps
- **Containerisation** : Docker
- **Orchestration** : Docker Compose
- **CI/CD** : GitHub Actions
- **Registry** : Docker Hub

## 📦 Installation

### Prérequis

- Docker & Docker Compose
- Node.js 22+ (pour développement local)
- OpenAI API Key

### Configuration

1. **Cloner le repository**
```bash
git clone https://github.com/YOUR_USERNAME/my-devops-bot.git
cd my-devops-bot
```

2. **Configurer les variables d'environnement**
```bash
# À la racine
echo "OPENAI_API_KEY=your_api_key_here" > .env

# Frontend
echo "VITE_API_URL=http://localhost:3003" > frontend-tutor/.env
```

3. **Lancer avec Docker Compose**
```bash
docker-compose up -d
```

4. **Accéder à l'application**
- Frontend : http://localhost:8080
- Backend API : http://localhost:3003

## 💻 Développement Local

### Backend

```bash
cd devops-tutor
npm install
npm run start:dev      # Mode développement
npm run test           # Tests Jest
npm run lint           # ESLint
```

### Frontend

```bash
cd frontend-tutor
npm install
npm run dev            # Mode développement
npm run test           # Tests Vitest
npm run lint           # ESLint
```

## 🧪 Tests

```bash
# Backend (Jest)
cd devops-tutor
npm run test:ci        # Tests avec coverage

# Frontend (Vitest)
cd frontend-tutor
npm run test:ci        # Tests avec coverage
```

## 🚢 Déploiement

Le pipeline CI/CD se déclenche automatiquement sur :
- Push vers `main` ou `develop`
- Pull Requests

Les images Docker sont publiées sur Docker Hub :
```bash
docker pull YOUR_USERNAME/devops-tutor-api:latest
docker pull YOUR_USERNAME/devops-tutor-web:latest
```

## 📚 Documentation

- [CI/CD Pipeline](.github/README.md)
- [Architecture] (À venir)
- [API Documentation] (À venir)

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'feat: add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 License

Ce projet est sous licence MIT.

## 👨‍💻 Auteur

Votre Nom - [GitHub](https://github.com/YOUR_USERNAME)

---

**Made with ❤️ for DevOps Learning**
