// ============================================
// DREAMHOUSE PRO - VISTAS MODULE CONSTANTS
// ============================================

export const ARCHITECTURAL_VISTAS = [
  // — Exteriores clásicos —
  "Perspectiva Principal (Hero Shot)",
  "Fachada Frontal (Elevación)",
  "Fachada Lateral Derecha",
  "Fachada Lateral Izquierda",
  "Fachada Posterior",
  "Vista Diagonal Posterior",
  // — Ángulos de cámara —
  "Perspectiva a Nivel de Calle",
  "Perspectiva Peatonal (Ojo humano)",
  "Vista Contrapicada",
  "Vista Gran Angular",
  // — Aéreas —
  "Vista Aérea (Drone)",
  "Vista Isométrica",
  "Vista de Cubierta",
  // — Acceso y entorno —
  "Vista de Acceso",
  "Vista desde Jardín",
  // — Iluminación especial —
  "Vista Crepuscular (Blue Hour)",
  "Vista Nocturna",
  // — Detalles —
  "Detalle de Fachada",
  "Detalle de Materialidad",
  // — Representación técnica —
  "Corte Perspectivado 3D",
  "Isométrica Explotada",
];

/** Short label shown in the UI under each chip (max ~6 words). */
export const VISTA_SHORT_DESC: Record<string, string> = {
  "Perspectiva Principal (Hero Shot)": "Ángulo estrella 3/4, la más usada",
  "Fachada Frontal (Elevación)": "Ortogonal, sin perspectiva",
  "Fachada Lateral Derecha": "Lateral derecho, profundidad de volumen",
  "Fachada Lateral Izquierda": "Lateral izquierdo, profundidad de volumen",
  "Fachada Posterior": "Parte trasera, jardín o patio",
  "Vista Diagonal Posterior": "3/4 trasero, volumen posterior",
  "Perspectiva a Nivel de Calle": "Desde la vereda de enfrente",
  "Perspectiva Peatonal (Ojo humano)": "Escala humana, cerca del acceso",
  "Vista Contrapicada": "Ángulo bajo mirando hacia arriba",
  "Vista Gran Angular": "Ultra-wide, casa en contexto",
  "Vista Aérea (Drone)": "Desde arriba, cubierta y entorno",
  "Vista Isométrica": "Isométrica de toda la casa, sin perspectiva",
  "Vista de Cubierta": "Plano cenital sobre la cubierta",
  "Vista de Acceso": "Desde la calle hacia la puerta",
  "Vista desde Jardín": "Desde el patio trasero",
  "Vista Crepuscular (Blue Hour)": "Hora azul, luces encendidas",
  "Vista Nocturna": "De noche, iluminación interior y exterior",
  "Detalle de Fachada": "Zoom en ventana, balcón o viga",
  "Detalle de Materialidad": "Macro: textura y encuentro de materiales",
  "Corte Perspectivado 3D": "Interior-exterior en un solo corte",
  "Isométrica Explotada": "Isométrica con pisos separados",
};

/** Full English descriptions used to build the generation prompt. */
export const VISTA_DESCRIPTIONS: Record<string, string> = {
  "Perspectiva Principal (Hero Shot)": "The most flattering 3/4 perspective of the building, showing its main volume and entrance in context.",
  "Fachada Frontal (Elevación)": "A perfectly parallel frontal elevation, showing the building's main facade with no perspective distortion.",
  "Fachada Lateral Derecha": "Side elevation from the right, showing volume depth and side openings.",
  "Fachada Lateral Izquierda": "Side elevation from the left, showing volume depth and side openings.",
  "Fachada Posterior": "Rear view of the building, often showing private areas or garden integration.",
  "Vista Diagonal Posterior": "A rear 3/4 perspective that reveals the back volume, secondary terraces, and garden relationship.",
  "Perspectiva a Nivel de Calle": "A slightly low-angle view from across the street, capturing the building's presence in the neighborhood.",
  "Perspectiva Peatonal (Ojo humano)": "View from the height of a person standing nearby, emphasizing scale and entrance.",
  "Vista Contrapicada": "A low camera angle looking upward at the building, emphasizing height, cantilevers, and structural drama.",
  "Vista Gran Angular": "An ultra-wide shot that places the building within its full site and landscape context.",
  "Vista Aérea (Drone)": "A high-angle bird's eye view showing the building's roofscape and its relationship with the site.",
  "Vista Isométrica": "A true isometric view of the whole building (camera about 35 degrees above the horizon, rotated 45 degrees, parallel lines with no perspective convergence), presenting the house as a clean three-dimensional object with its roof and two facades visible, on a simple neutral ground.",
  "Vista de Cubierta": "A top-down or near-top-down view focusing on the roof geometry, skylights, and rooftop elements.",
  "Vista de Acceso": "A pedestrian approach shot from the street moving toward the main entrance, capturing the arrival sequence.",
  "Vista desde Jardín": "View from the rear garden or private patio looking back at the house, showing indoor-outdoor flow.",
  "Vista Crepuscular (Blue Hour)": "A twilight shot during blue hour with interior lights glowing, exterior illumination, and a moody sky.",
  "Vista Nocturna": "A full night-time photograph with dramatic artificial lighting highlighting the building's form and transparency.",
  "Detalle de Fachada": "A medium shot focusing on a specific architectural feature like a window system or balcony.",
  "Detalle de Materialidad": "A macro close-up focus on the intersection of two primary materials (e.g., concrete and wood).",
  "Corte Perspectivado 3D": "A creative architectural representation where a portion of the building is 'cut' to show the interior-exterior relationship.",
  "Isométrica Explotada": "An artistic isometric view where the roof or floors are slightly detached to show the internal layout.",
};

/**
 * Qué le exige cada vista al modelo respecto a la imagen de referencia:
 * - seen:     muestra lo que ya se ve en la referencia desde otro ángulo/distancia
 * - unseen:   muestra caras o elementos que NO se ven en la referencia (hay que deducirlos con cuidado)
 * - lighting: la geometría no cambia; solo la hora y la iluminación
 * - detail:   un acercamiento a un detalle real de la referencia
 * - diagram:  una representación deliberada (corte, isométrica), no una foto
 */
export type VistaKind = 'seen' | 'unseen' | 'lighting' | 'detail' | 'diagram';

export const VISTA_KINDS: Record<string, VistaKind> = {
  "Perspectiva Principal (Hero Shot)": 'seen',
  "Fachada Frontal (Elevación)": 'seen',
  "Fachada Lateral Derecha": 'unseen',
  "Fachada Lateral Izquierda": 'unseen',
  "Fachada Posterior": 'unseen',
  "Vista Diagonal Posterior": 'unseen',
  "Perspectiva a Nivel de Calle": 'seen',
  "Perspectiva Peatonal (Ojo humano)": 'seen',
  "Vista Contrapicada": 'seen',
  "Vista Gran Angular": 'seen',
  "Vista Aérea (Drone)": 'unseen',
  "Vista Isométrica": 'unseen',
  "Vista de Cubierta": 'unseen',
  "Vista de Acceso": 'seen',
  "Vista desde Jardín": 'unseen',
  "Vista Crepuscular (Blue Hour)": 'lighting',
  "Vista Nocturna": 'lighting',
  "Detalle de Fachada": 'detail',
  "Detalle de Materialidad": 'detail',
  "Corte Perspectivado 3D": 'diagram',
  "Isométrica Explotada": 'diagram',
};

/**
 * Las vistas básicas de un portafolio: las que casi siempre se piden y que ya vienen marcadas al entrar al módulo.
 * La persona puede quitarlas o sumar otras; «Restablecer básicas» las devuelve.
 */
export const DEFAULT_VISTAS: string[] = [
  "Perspectiva Principal (Hero Shot)",
  "Fachada Frontal (Elevación)",
  "Vista Aérea (Drone)",
  "Vista Isométrica",
];
