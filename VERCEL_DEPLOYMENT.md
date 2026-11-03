# Guía de Deployment en Vercel

Esta guía explica cómo configurar correctamente el proyecto DreamHouse para su despliegue en Vercel.

## Problemas Comunes y Soluciones

### 1. Error 504 Gateway Timeout

**Problema:** Las solicitudes a `/api/generate` tardan entre 20-55 segundos, pero Vercel Hobby tiene un límite de **10 segundos**.

**Solución:**
- **Opción A (Recomendada):** Actualizar a Vercel Pro ($20/mes) que permite hasta 300 segundos de ejecución
- **Opción B:** Optimizar las imágenes antes de subirlas para reducir el tiempo de procesamiento
- **Opción C:** Usar un servicio externo para procesamiento asíncrono (ej: Queue con BullMQ)

**Configuración en Vercel Pro:**
El archivo `src/app/api/generate/route.ts` ya incluye `export const maxDuration = 60;` que permite 60 segundos de ejecución en el plan Pro.

### 2. Error 413 Payload Too Large

**Problema:** Vercel limita el tamaño del cuerpo de la solicitud a **4.5MB**. Múltiples imágenes en Base64 pueden exceder este límite.

**Solución:**
- El código ya incluye validación de tamaño en el cliente y servidor
- Límite por imagen: **Sin límite (App)** / **4.5MB (Vercel)**
- Límite total del payload: **Sin límite (App)** / **4.5MB (Vercel)**
- Máximo de imágenes de referencia: **5**

**Validación Automática:**
- El cliente valida antes de enviar
- El servidor valida antes de procesar
- Mensajes de error claros si se excede el límite

### 3. Variable de Entorno Faltante

**Problema:** `GEMINI_API_KEY` no está configurada en Vercel.

**Solución:**

#### Paso 1: Obtener API Key de Google Gemini

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Crea una nueva API Key
4. Copia la clave (empieza con `AIza...`)

#### Paso 2: Configurar en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Navega a **Settings** → **Environment Variables**
3. Añade una nueva variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Tu API key de Google Gemini
   - **Environments:** Selecciona `Production`, `Preview`, y `Development`
4. Haz clic en **Save**

#### Paso 3: Redesplegar

Después de añadir la variable de entorno, necesitas redesplegar:

```bash
# Opción 1: Desde Vercel Dashboard
# Ve a Deployments → Click en los tres puntos → Redeploy

# Opción 2: Desde terminal
git commit --allow-empty -m "Trigger redeploy"
git push
```

### 4. Versión de Next.js

**Problema:** La versión `16.0.4` de Next.js no existe o es inestable.

**Solución:**
- El `package.json` ha sido actualizado a Next.js `^15.1.0` (versión estable)
- Ejecuta `npm install` para actualizar las dependencias

## Configuración Completa en Vercel

### Variables de Entorno Requeridas

| Variable | Descripción | Dónde Obtenerla |
|----------|-------------|-----------------|
| `OPENAI_API_KEY` | Opcional. Respaldo en el servidor para GPT Image 2.5, el modelo predeterminado (cada usuario pega su propia clave en la app). Con esta clave la calidad se limita a "Estándar" y la resolución a 2K | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `GEMINI_API_KEY` | Opcional. Solo se usa si se elige el modelo Gemini | [Google AI Studio](https://makersuite.google.com/app/apikey) |

### Configuración de Build

Vercel detecta automáticamente Next.js, pero puedes verificar en **Settings** → **General**:

- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (automático)
- **Output Directory:** `.next` (automático)
- **Install Command:** `npm install` (automático)

### Límites de Vercel

| Plan | Tiempo Máximo de Ejecución | Tamaño Máximo de Payload |
|------|---------------------------|--------------------------|
| Hobby (Gratis) | 10 segundos | 4.5MB |
| Pro ($20/mes) | 300 segundos | 4.5MB |
| Enterprise | 900 segundos | 4.5MB |

**Recomendación:** Para este proyecto, se requiere al menos el plan **Pro** debido a los tiempos de generación de imágenes (20-55 segundos).

## Verificación Post-Deployment

Después del despliegue, verifica:

1. ✅ La aplicación carga correctamente
2. ✅ Las variables de entorno están configuradas (revisa los logs si hay errores)
3. ✅ Puedes subir imágenes (verifica que la validación de tamaño funciona)
4. ✅ La generación de imágenes funciona (puede tardar 20-55 segundos)

## Troubleshooting

### Error: "GEMINI_API_KEY is not configured"

**Causa:** La variable de entorno no está configurada o el proyecto no se ha redesplegado después de añadirla.

**Solución:**
1. Verifica que la variable existe en Vercel Dashboard
2. Asegúrate de que está habilitada para el entorno correcto (Production/Preview/Development)
3. Redesplega el proyecto

### Error: "Request timeout"

**Causa:** El plan Hobby tiene un límite de 10 segundos, pero la generación tarda más.

**Solución:**
- Actualiza a Vercel Pro
- O reduce la complejidad de las imágenes (menos imágenes, menor resolución)

### Error: "Payload too large"

**Causa:** El tamaño total de las imágenes excede los 4.5MB permitidos por Vercel (independientemente de que la app permita más).

**Solución:**
- Reduce el número de imágenes
- Comprime las imágenes antes de subirlas
- Usa imágenes con menor resolución

## Optimizaciones Adicionales

### Optimizar Imágenes en el Cliente

Considera añadir compresión de imágenes antes de subirlas:

```typescript
// Ejemplo con browser-image-compression
import imageCompression from 'browser-image-compression';

const compressImage = async (file: File) => {
  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  };
  return await imageCompression(file, options);
};
```

### Monitoreo

Configura alertas en Vercel para:
- Errores 504 (timeouts)
- Errores 413 (payload too large)
- Errores 500 (problemas con API key)

## Recursos

- [Documentación de Vercel](https://vercel.com/docs)
- [Límites de Vercel](https://vercel.com/docs/concepts/limits/overview)
- [Google Gemini API](https://ai.google.dev/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

