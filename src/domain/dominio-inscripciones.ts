import { RepositorioEvento } from './puerto-repositorio';
import { normalizarTelefono } from './telefono';
import {
  ApuntarJugadorComando,
  CancelarInscripcionComando,
  ConfirmarPendienteComando,
  DatosInscripcionInvalidosError,
  EstadoInscripcionInvalidoError,
  EstadoVisibleEvento,
  EventoNoEncontradoError,
  Inscripcion,
  InscripcionNoEncontradaError,
  OperacionNoPermitidaError,
  RechazarPendienteComando,
  ReordenarListaEsperaComando,
  ResultadoApuntar,
  ResultadoCancelar,
  ResultadoRechazar,
} from './tipos';

export class DominioInscripciones {
  constructor(private readonly repo: RepositorioEvento) {}

  /**
   * Apunta a un jugador a un evento vía enlace público o por alta directa.
   * Reglas:
   * 1. Valida teléfono (formato es-ES) y apodo (no vacío).
   * 2. Si llegadaTardia es true, horaEstimadaLlegada es obligatoria.
   * 3. Deduplicación: máx. una inscripción activa por (evento, teléfono). Si ya existe, devuelve la existente.
   * 4. Si hay cupo libre -> Confirmado ocupando plaza.
   * 5. Si el cupo está agotado:
   *    - Si la lista de espera está permitida -> entra al final de la Lista de espera con su posición correlativa.
   *    - Si la lista de espera está desactivada -> "Evento completo" (no entra en cola).
   */
  async apuntarJugador(comando: ApuntarJugadorComando): Promise<ResultadoApuntar> {
    const apodoLimpio = comando.apodo ? comando.apodo.trim() : '';
    if (!apodoLimpio) {
      throw new DatosInscripcionInvalidosError('El apodo o nombre es obligatorio');
    }

    const telefonoNormalizado = normalizarTelefono(comando.telefono);

    if (comando.llegadaTardia) {
      if (!comando.horaEstimadaLlegada || !comando.horaEstimadaLlegada.trim()) {
        throw new DatosInscripcionInvalidosError(
          'La hora estimada de llegada es obligatoria cuando se indica llegada tardía'
        );
      }
    }

    const evento = await this.repo.buscarEventoPorId(comando.eventoId);
    if (!evento) {
      throw new EventoNoEncontradoError(comando.eventoId);
    }

    if (evento.estado === 'cancelado') {
      throw new OperacionNoPermitidaError(
        'No se admiten inscripciones en un evento cancelado'
      );
    }

    const todasInscripciones = await this.repo.listarInscripcionesPorEvento(
      comando.eventoId
    );

    // Comprobar deduplicación: máx. una inscripción activa por teléfono/evento
    const inscripcionActiva = todasInscripciones.find(
      (ins) => ins.telefono === telefonoNormalizado && ins.estado !== 'cancelado'
    );

    if (inscripcionActiva) {
      return {
        tipo: 'ya_inscrito',
        inscripcion: inscripcionActiva,
        duplicada: true,
      };
    }

    // Calcular plazas ocupadas (Confirmados + Pendientes de confirmación ocupan plaza)
    const ocupadas = todasInscripciones.filter(
      (ins) =>
        ins.estado === 'confirmado' || ins.estado === 'pendiente_de_confirmacion'
    );

    const ahora = new Date();

    if (ocupadas.length < evento.cupo) {
      const nuevaInscripcion: Inscripcion = {
        id: crypto.randomUUID(),
        eventoId: evento.id,
        telefono: telefonoNormalizado,
        apodo: apodoLimpio,
        estado: 'confirmado',
        llegadaTardia: comando.llegadaTardia,
        horaEstimadaLlegada: comando.llegadaTardia
          ? comando.horaEstimadaLlegada?.trim()
          : undefined,
        creadoEn: ahora,
        actualizadoEn: ahora,
      };

      await this.repo.guardarInscripcion(nuevaInscripcion);

      return {
        tipo: 'confirmado',
        inscripcion: nuevaInscripcion,
        duplicada: false,
      };
    }

    // Cupo agotado
    if (!evento.permiteListaEspera) {
      return {
        tipo: 'evento_completo',
      };
    }

    // Entra al final de la lista de espera
    const enEspera = todasInscripciones
      .filter((ins) => ins.estado === 'en_lista_de_espera')
      .sort((a, b) => (a.posicionEspera ?? 0) - (b.posicionEspera ?? 0));

    const posicion = enEspera.length + 1;

    const nuevaInscripcion: Inscripcion = {
      id: crypto.randomUUID(),
      eventoId: evento.id,
      telefono: telefonoNormalizado,
      apodo: apodoLimpio,
      estado: 'en_lista_de_espera',
      llegadaTardia: comando.llegadaTardia,
      horaEstimadaLlegada: comando.llegadaTardia
        ? comando.horaEstimadaLlegada?.trim()
        : undefined,
      posicionEspera: posicion,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };

    await this.repo.guardarInscripcion(nuevaInscripcion);

    return {
      tipo: 'en_lista_de_espera',
      inscripcion: nuevaInscripcion,
      posicion,
      duplicada: false,
    };
  }

  /**
   * Cancela una inscripción existente (por el propio Jugador o por el Organizador).
   * Reglas:
   * 1. Registra quién provocó la cancelación ('jugador' | 'organizador').
   * 2. Si la inscripción ocupaba plaza (confirmado o pendiente de confirmación),
   *    se libera una plaza y se dispara la Promoción Atómica (ADR-0003):
   *    el primero de la Lista de espera pasa de inmediato a Pendiente de confirmación
   *    ocupando dicha plaza. La cola de espera restante se reindexa.
   * 3. Si la inscripción cancelada estaba en lista de espera, no ocupaba plaza;
   *    no se promueve a nadie pero la cola se reindexa.
   */
  async cancelarInscripcion(
    comando: CancelarInscripcionComando
  ): Promise<ResultadoCancelar> {
    const evento = await this.repo.buscarEventoPorId(comando.eventoId);
    if (!evento) {
      throw new EventoNoEncontradoError(comando.eventoId);
    }

    const inscripcion = await this.repo.buscarInscripcionPorId(
      comando.inscripcionId
    );
    if (!inscripcion || inscripcion.eventoId !== comando.eventoId) {
      throw new InscripcionNoEncontradaError(comando.inscripcionId);
    }

    if (inscripcion.estado === 'cancelado') {
      return { inscripcionCancelada: inscripcion };
    }

    const estadoAnterior = inscripcion.estado;
    const ahora = new Date();

    const inscripcionCancelada: Inscripcion = {
      ...inscripcion,
      estado: 'cancelado',
      canceladoPor: comando.canceladoPor,
      posicionEspera: undefined,
      actualizadoEn: ahora,
    };

    await this.repo.guardarInscripcion(inscripcionCancelada);

    let inscripcionPromovida: Inscripcion | undefined;

    const todas = await this.repo.listarInscripcionesPorEvento(comando.eventoId);
    const listaActual = todas.map((i) =>
      i.id === inscripcionCancelada.id ? inscripcionCancelada : i
    );

    if (
      estadoAnterior === 'confirmado' ||
      estadoAnterior === 'pendiente_de_confirmacion'
    ) {
      // Plaza liberada -> Promoción atómica
      const enEspera = listaActual
        .filter((i) => i.estado === 'en_lista_de_espera')
        .sort((a, b) => (a.posicionEspera ?? 0) - (b.posicionEspera ?? 0));

      if (enEspera.length > 0) {
        const primero = enEspera[0];
        inscripcionPromovida = {
          ...primero,
          estado: 'pendiente_de_confirmacion',
          posicionEspera: undefined,
          actualizadoEn: ahora,
        };

        await this.repo.guardarInscripcion(inscripcionPromovida);

        // Reindexar el resto de la cola
        const resto = enEspera.slice(1).map((ins, idx) => ({
          ...ins,
          posicionEspera: idx + 1,
          actualizadoEn: ahora,
        }));

        if (resto.length > 0) {
          await this.repo.guardarInscripciones(resto);
        }
      }
    } else if (estadoAnterior === 'en_lista_de_espera') {
      // Reindexar la cola de espera
      const enEspera = listaActual
        .filter(
          (i) =>
            i.estado === 'en_lista_de_espera' && i.id !== comando.inscripcionId
        )
        .sort((a, b) => (a.posicionEspera ?? 0) - (b.posicionEspera ?? 0));

      const reindexados = enEspera.map((ins, idx) => ({
        ...ins,
        posicionEspera: idx + 1,
        actualizadoEn: ahora,
      }));

      if (reindexados.length > 0) {
        await this.repo.guardarInscripciones(reindexados);
      }
    }

    return {
      inscripcionCancelada,
      inscripcionPromovida,
    };
  }

  /**
   * Confirma a un jugador que estaba Pendiente de confirmación (acción exclusiva del Organizador).
   * Pasa a Confirmado definitivo ocupando la misma plaza que ya retenía.
   */
  async confirmarPendiente(
    comando: ConfirmarPendienteComando
  ): Promise<Inscripcion> {
    const evento = await this.repo.buscarEventoPorId(comando.eventoId);
    if (!evento) {
      throw new EventoNoEncontradoError(comando.eventoId);
    }

    const inscripcion = await this.repo.buscarInscripcionPorId(
      comando.inscripcionId
    );
    if (!inscripcion || inscripcion.eventoId !== comando.eventoId) {
      throw new InscripcionNoEncontradaError(comando.inscripcionId);
    }

    if (inscripcion.estado !== 'pendiente_de_confirmacion') {
      throw new EstadoInscripcionInvalidoError(
        `Solo se puede confirmar una inscripción en estado pendiente_de_confirmacion (estado actual: ${inscripcion.estado})`
      );
    }

    const confirmada: Inscripcion = {
      ...inscripcion,
      estado: 'confirmado',
      actualizadoEn: new Date(),
    };

    await this.repo.guardarInscripcion(confirmada);
    return confirmada;
  }

  /**
   * Rechaza a un jugador que estaba Pendiente de confirmación (acción exclusiva del Organizador).
   * Pasa a Cancelado (provocado por el Organizador), se libera su plaza y la Promoción
   * continúa atómicamente con el siguiente de la Lista de espera según el orden vigente.
   */
  async rechazarPendiente(
    comando: RechazarPendienteComando
  ): Promise<ResultadoRechazar> {
    const evento = await this.repo.buscarEventoPorId(comando.eventoId);
    if (!evento) {
      throw new EventoNoEncontradoError(comando.eventoId);
    }

    const inscripcion = await this.repo.buscarInscripcionPorId(
      comando.inscripcionId
    );
    if (!inscripcion || inscripcion.eventoId !== comando.eventoId) {
      throw new InscripcionNoEncontradaError(comando.inscripcionId);
    }

    if (inscripcion.estado !== 'pendiente_de_confirmacion') {
      throw new EstadoInscripcionInvalidoError(
        `Solo se puede rechazar una inscripción en estado pendiente_de_confirmacion (estado actual: ${inscripcion.estado})`
      );
    }

    // Al cancelar con canceladoPor: 'organizador', cancelarInscripcion libera la plaza y promueve al siguiente
    const resultadoCancelacion = await this.cancelarInscripcion({
      eventoId: comando.eventoId,
      inscripcionId: comando.inscripcionId,
      canceladoPor: 'organizador',
    });

    return {
      inscripcionRechazada: resultadoCancelacion.inscripcionCancelada,
      inscripcionPromovida: resultadoCancelacion.inscripcionPromovida,
    };
  }

  /**
   * Reordena la Lista de espera (acción exclusiva del Organizador).
   * La lista de IDs recibida debe contener exactamente todos los IDs de inscripciones
   * actualmente activas en la Lista de espera.
   */
  async reordenarListaEspera(
    comando: ReordenarListaEsperaComando
  ): Promise<Inscripcion[]> {
    const evento = await this.repo.buscarEventoPorId(comando.eventoId);
    if (!evento) {
      throw new EventoNoEncontradoError(comando.eventoId);
    }

    const todas = await this.repo.listarInscripcionesPorEvento(comando.eventoId);
    const enEspera = todas.filter((i) => i.estado === 'en_lista_de_espera');

    const idsActuales = new Set(enEspera.map((i) => i.id));
    const idsNuevos = comando.nuevoOrdenInscripcionIds;

    if (idsNuevos.length !== idsActuales.size) {
      throw new OperacionNoPermitidaError(
        `El nuevo orden debe contener exactamente los ${idsActuales.size} jugadores en espera actuales`
      );
    }

    const setNuevos = new Set(idsNuevos);
    if (setNuevos.size !== idsNuevos.length) {
      throw new OperacionNoPermitidaError('El nuevo orden contiene IDs duplicados');
    }

    for (const id of idsNuevos) {
      if (!idsActuales.has(id)) {
        throw new OperacionNoPermitidaError(
          `El ID ${id} no corresponde a una inscripción activa en la lista de espera`
        );
      }
    }

    const mapaEspera = new Map(enEspera.map((i) => [i.id, i]));
    const ahora = new Date();

    const reordenadas: Inscripcion[] = idsNuevos.map((id, index) => {
      const ins = mapaEspera.get(id)!;
      return {
        ...ins,
        posicionEspera: index + 1,
        actualizadoEn: ahora,
      };
    });

    await this.repo.guardarInscripciones(reordenadas);
    return reordenadas;
  }

  /**
   * Devuelve el estado visible del evento y el desglose de inscripciones.
   */
  async obtenerEstadoEvento(eventoId: string): Promise<EstadoVisibleEvento> {
    const evento = await this.repo.buscarEventoPorId(eventoId);
    if (!evento) {
      throw new EventoNoEncontradoError(eventoId);
    }

    const inscripciones = await this.repo.listarInscripcionesPorEvento(eventoId);

    const confirmados = inscripciones.filter((i) => i.estado === 'confirmado');
    const pendientesConfirmacion = inscripciones.filter(
      (i) => i.estado === 'pendiente_de_confirmacion'
    );
    const listaEspera = inscripciones
      .filter((i) => i.estado === 'en_lista_de_espera')
      .sort((a, b) => (a.posicionEspera ?? 0) - (b.posicionEspera ?? 0));
    const cancelados = inscripciones.filter((i) => i.estado === 'cancelado');

    const plazasOcupadas = confirmados.length + pendientesConfirmacion.length;
    const plazasLibres = Math.max(0, evento.cupo - plazasOcupadas);

    return {
      evento,
      cupo: evento.cupo,
      plazasOcupadas,
      plazasLibres,
      confirmados,
      pendientesConfirmacion,
      listaEspera,
      cancelados,
    };
  }
}
