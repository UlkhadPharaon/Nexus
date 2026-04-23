# 🚀 Guide Ultime : Migration Serverless & Intégration NVIDIA NIM

Ce document est une ressource exhaustive pour migrer votre application d'une architecture monolithique (Express/Node.js) vers une architecture **Serverless moderne**, déployable gratuitement sur **Vercel**, tout en exploitant la puissance des modèles IA de **NVIDIA NIM**.

---

## 📖 Sommaire
1. [Concepts Fondamentaux : Express vs Serverless](#1-concepts-fondamentaux)
2. [Configuration NVIDIA NIM](#2-configuration-nvidia-nim)
3. [Architecture du Projet Serverless](#3-architecture-du-projet)
4. [Migration Technique (Étape par Étape)](#4-migration-technique)
5. [Gestion avancée : Streaming & Image](#5-gestion-avancée)
6. [Déploiement sur Vercel](#6-déploiement-sur-vercel)
7. [Foire Aux Questions (FAQ)](#7-faq)

---

## 1. Concepts Fondamentaux : Express vs Serverless <a name="1-concepts-fondamentaux"></a>

Dans un mode **Serveur (Express)**, votre application est un processus qui écoute en permanence sur un port (ex: 3000). 
En mode **Serverless (Vercel)**, chaque endpoint est une fonction indépendante qui est "réveillée" uniquement lors d'un appel.

### Pourquoi migrer ?
- **Coût Zéro** : Vercel offre un tiers gratuit généreux pour les fonctions serverless.
- **Maintenance** : Plus besoin de gérer les process Node, les redémarrages ou les ports.
- **Vitesse** : Les fonctions s'exécutent au plus proche de l'utilisateur (Edge Network).

---

## 2. Configuration NVIDIA NIM <a name="2-configuration-nvidia-nim"></a>

NVIDIA NIM fournit des microservices d'inférence hautement optimisés.

1. **Obtention de la clé** : [build.nvidia.com](https://build.nvidia.com/)
2. **Variables d'environnement** :
   Créez ou modifiez votre `.env` (ou `.env.example`) :
   ```env
   NVIDIA_API_KEY=nvapi-XXXXXX...
   ```
   *Note : N'utilisez PAS le préfixe `VITE_` pour cette clé afin qu'elle reste secrète côté serveur.*

---

## 3. Architecture du Projet Serverless <a name="3-architecture-du-projet"></a>

L'architecture repose sur la séparation stricte entre le Frontend (Vite/React) et le Backend (Vercel Functions).

```text
/
├── api/                <-- Vos fonctions Serverless (Node/Edge)
│   ├── chat.ts         <-- Handler pour le texte (NVIDIA NIM)
│   └── generateimg.ts  <-- Handler pour l'image (NVIDIA NIM)
├── src/                <-- Votre code React
├── public/             <-- Assets statiques
├── package.json        <-- Scripts et dépendances
├── vercel.json         <-- Configuration de routage
└── vite.config.ts      <-- Config de build et proxy de dev
```

---

## 4. Migration Technique (Étape par Étape) <a name="4-migration-technique"></a>

### Étape 1 : Le fichier `vercel.json` (Le cerveau du routage)
Ce fichier indique à Vercel comment rediriger les appels d'API vers vos fonctions.

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Étape 2 : Créer une fonction API (Edge Runtime)
Voici comment implémenter un proxy sécurisé pour NVIDIA NIM dans `/api/chat.ts`.

```typescript
// /api/chat.ts
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  // 1. Validation de la méthode
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const apiKey = process.env.NVIDIA_API_KEY;
  const body = await req.json();

  // 2. Appel à NVIDIA NIM
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: body.model || "meta/llama-3.1-405b-instruct",
        messages: body.messages,
        temperature: 0.5,
        max_tokens: 1024,
        stream: body.stream || false
      })
    });

    // 3. Retour de la réponse
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
```

### Étape 3 : Nettoyer `server.ts` et `package.json`
Vite sur Vercel ne nécessite plus `server.ts`. 
1. Supprimez `server.ts` (une fois vos routes d'API migrées dans le dossier `api/`).
2. Modifiez vos scripts :
   ```json
   "scripts": {
     "dev": "vite",
     "build": "vite build",
     "preview": "vite preview"
   }
   ```
3. Supprimez `express` de vos dépendances (`npm uninstall express`).

### Étape 4 : Adapter le Frontend
Dans vos appels `fetch`, n'utilisez plus d'URL absolue (localhost). Utilisez des chemins relatifs.

```typescript
// src/services/api.ts
export async function askAI(messages: any[]) {
  const response = await fetch("/api/chat", { // Route relative
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  return await response.json();
}
```

---

## 5. Gestion avancée : Streaming & Image <a name="5-gestion-avancée"></a>

### Le Streaming (Mode Temps Réel)
Le streaming en serverless (Edge) est extrêmement efficace car il maintient la connexion ouverte sans consommer de RAM serveur. Côté client, utilisez un reader :

```typescript
const response = await fetch('/api/chat', { ... });
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Traîtez votre chunk ici
}
```

### Génération d'Image
L'API NIM renvoie souvent du Base64. Votre fonction `/api/image.ts` doit simplement passer ce Base64.

```typescript
// /api/image.ts
export default async function handler(req: Request) {
  const { prompt } = await req.json();
  const res = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b", {
     // ... headers ...
     body: JSON.stringify({ prompt, width: 1024, height: 1024 })
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
```

---

## 6. Déploiement sur Vercel <a name="6-déploiement-sur-vercel"></a>

1. **GitHub** : Liez votre repository à Vercel.
2. **Settings** : Dans l'onglet **Environment Variables**, ajoutez toutes les clés définies dans votre `.env.example`.
3. **Build** : Vercel détecte automatiquement `vite build` comme commande de build et `dist` comme dossier de sortie.
4. **Logs** : Utilisez l'onglet **Logs** de Vercel pour déboguer vos fonctions `/api` en temps réel.

---

## 7. FAQ <a name="7-faq"></a>

**Q: Puis-je tester mes routes `/api` en local ?**
R: Oui ! Utilisez la commande `npx vercel dev`. Elle émulera l'environnement Vercel (frontend + fonctions API) sur votre machine.

**Q: Pourquoi ma fonction API Timeout au bout de 10 secondes ?**
R: Les fonctions gratuites sur Vercel ont une limite de temps d'exécution (10s pour les Serverless Functions classiques). Pour les appels IA longs, utilisez le **Edge Runtime** (`runtime: 'edge'`) qui n'a pas cette limite stricte mais nécessite d'utiliser des APIs web standard (pas de `fs` ou `path`).

**Q: Dois-je configurer un proxy dans `vite.config.ts` ?**
R: Pour le développement local classique (`npm run dev`), vous pouvez ajouter :
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3000'
  }
}
```
*Note : Si vous utilisez `vercel dev`, ce proxy n'est pas nécessaire.*

---

**Félicitations !** Vous disposez maintenant d'un socle technique solide, sécurisé et gratuit pour propulser vos applications IA avec NVIDIA NIM.
