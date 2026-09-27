export type TipoEvento = 'cash' | 'torneo';

export type EstadoEvento = 'activo' | 'cancelado';

export interface Evento {
  id: string;
  organizadorId: string;
  slug: string;
  tipo: TipoEvento;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  cupo: number;
  nota?: string;
  permiteListaEspera: boolean;
  estado: EstadoEvento;
  creadoEn: Date;
}

export type EstadoInscripcion =
  | 'confirmado'
  | 'pendiente_de_confirmacion'
  | 'en_lista_de_espera'
  | 'cancelado';

export type AtribucionCancelacion = 'jugador' | 'organizador';

export interface Inscripcion {
  id: string;
  eventoId: string;
  telefono: string; // Formato estándar (+34XXXXXXXXX)
  apodo: string;
  estado: EstadoInscripcion;
  llegadaTardia: boolean;
  horaEstimadaLlegada?: string; // Obligatoria si llegadaTardia es true
  canceladoPor?: AtribucionCancelacion;
  posicionEspera?: number; // Solo definida si estado === 'en_lista_de_espera'
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface ApuntarJugadorComando {
  eventoId: string;
  telefono: string;
  apodo: string;
  llegadaTardia: boolean;
  horaEstimadaLlegada?: string;
}

export type ResultadoApuntar =
  | { tipo: 'confirmado'; inscripcion: Inscripcion; duplicada: false }
  | {
      tipo: 'en_lista_de_espera';
      inscripcion: Inscripcion;
      posicion: number;
      duplicada: false;
    }
  | { tipo: 'evento_completo' }
  | { tipo: 'ya_inscrito'; inscripcion: Inscripcion; duplicada: true };

export interface CancelarInscripcionComando {
  eventoId: string;
  inscripcionId: string;
  canceladoPor: AtribucionCancelacion;
}

export interface ResultadoCancelar {
  inscripcionCancelada: Inscripcion;
  inscripcionPromovida?: Inscripcion;
}

export interface ConfirmarPendienteComando {
  eventoId: string;
  inscripcionId: string;
}

export interface RechazarPendienteComando {
  eventoId: string;
  inscripcionId: string;
}

export interface ResultadoRechazar {
  inscripcionRechazada: Inscripcion;
  inscripcionPromovida?: Inscripcion;
}

export interface ReordenarListaEsperaComando {
  eventoId: string;
  nuevoOrdenInscripcionIds: string[];
}

export interface EstadoVisibleEvento {
  evento: Evento;
  cupo: number;
  plazasOcupadas: number;
  plazasLibres: number;
  confirmados: Inscripcion[];
  pendientesConfirmacion: Inscripcion[];
  listaEspera: Inscripcion[];
  cancelados: Inscripcion[];
}

export class EventoNoEncontradoError extends Error {
  constructor(id: string) {
    super(`Evento no encontrado: ${id}`);
    this.name = 'EventoNoEncontradoError';
  }
}

export class InscripcionNoEncontradaError extends Error {
  constructor(id: string) {
    super(`Inscripción no encontrada: ${id}`);
    this.name = 'InscripcionNoEncontradaError';
  }
}

export class DatosInscripcionInvalidosError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'DatosInscripcionInvalidosError';
  }
}

export class EstadoInscripcionInvalidoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'EstadoInscripcionInvalidoError';
  }
}

export class OperacionNoPermitidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'OperacionNoPermitidaError';
  }
}
