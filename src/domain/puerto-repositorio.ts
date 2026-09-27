import { Evento, Inscripcion } from './tipos';

export interface RepositorioEvento {
  buscarEventoPorId(id: string): Promise<Evento | null>;
  buscarEventoPorSlug(slug: string): Promise<Evento | null>;
  guardarEvento(evento: Evento): Promise<void>;

  listarInscripcionesPorEvento(eventoId: string): Promise<Inscripcion[]>;
  buscarInscripcionPorId(id: string): Promise<Inscripcion | null>;
  guardarInscripcion(inscripcion: Inscripcion): Promise<void>;
  guardarInscripciones(inscripciones: Inscripcion[]): Promise<void>;
}
