import { RepositorioEvento } from './puerto-repositorio';
import { Evento, Inscripcion } from './tipos';

export class RepositorioEnMemoria implements RepositorioEvento {
  private eventos = new Map<string, Evento>();
  private inscripciones = new Map<string, Inscripcion>();

  async buscarEventoPorId(id: string): Promise<Evento | null> {
    const ev = this.eventos.get(id);
    return ev ? { ...ev } : null;
  }

  async buscarEventoPorSlug(slug: string): Promise<Evento | null> {
    for (const ev of this.eventos.values()) {
      if (ev.slug === slug) {
        return { ...ev };
      }
    }
    return null;
  }

  async guardarEvento(evento: Evento): Promise<void> {
    this.eventos.set(evento.id, { ...evento });
  }

  async listarInscripcionesPorEvento(eventoId: string): Promise<Inscripcion[]> {
    const list: Inscripcion[] = [];
    for (const ins of this.inscripciones.values()) {
      if (ins.eventoId === eventoId) {
        list.push({ ...ins });
      }
    }
    return list;
  }

  async buscarInscripcionPorId(id: string): Promise<Inscripcion | null> {
    const ins = this.inscripciones.get(id);
    return ins ? { ...ins } : null;
  }

  async guardarInscripcion(inscripcion: Inscripcion): Promise<void> {
    this.inscripciones.set(inscripcion.id, { ...inscripcion });
  }

  async guardarInscripciones(inscripciones: Inscripcion[]): Promise<void> {
    for (const ins of inscripciones) {
      this.inscripciones.set(ins.id, { ...ins });
    }
  }

  // Helper para tests
  limpiar(): void {
    this.eventos.clear();
    this.inscripciones.clear();
  }
}
