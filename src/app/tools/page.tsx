import { redirect } from 'next/navigation';

// Tools vive dentro del Studio (módulo de trabajo «Tools»): se conserva la ruta antigua como atajo.
export default function ToolsRedirect() {
  redirect('/studio');
}
