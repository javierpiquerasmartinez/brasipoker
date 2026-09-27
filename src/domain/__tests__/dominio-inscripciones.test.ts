import { beforeEach, describe, expect, it } from 'vitest';
import { RepositorioEnMemoria } from '../adaptador-memoria';
import { DominioInscripciones } from '../dominio-inscripciones';
import { DatosInscripcionInvalidosError, Evento } from '../tipos';

describe('DominioInscripciones — Seam de Dominio', () => {
  let repo: RepositorioEnMemoria;
  let dominio: DominioInscripciones;

  const eventoBase: Evento = {
    id: 'ev-1',
    organizadorId: 'org-1',
    slug: 'poker-viernes',
    tipo: 'cash',
    fecha: '2026-10-02',
    hora: '21:00',
    cupo: 3,
    permiteListaEspera: true,
    estado: 'activo',
    creadoEn: new Date('2026-09-27T10:00:00Z'),
  };

  beforeEach(async () => {
    repo = new RepositorioEnMemoria();
    await repo.guardarEvento(eventoBase);
    dominio = new DominioInscripciones(repo);
  });

  describe('Alta directa (con Plaza libre)', () => {
    it('inscribe a un jugador como Confirmado ocupando plaza cuando hay cupo disponible', async () => {
      const resultado = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '612345678',
        apodo: 'FishPro',
        llegadaTardia: false,
      });

      expect(resultado.tipo).toBe('confirmado');
      if (resultado.tipo === 'confirmado') {
        expect(resultado.inscripcion.estado).toBe('confirmado');
        expect(resultado.inscripcion.telefono).toBe('+34612345678');
        expect(resultado.inscripcion.apodo).toBe('FishPro');
        expect(resultado.inscripcion.llegadaTardia).toBe(false);
        expect(resultado.duplicada).toBe(false);
      }

      const estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.plazasOcupadas).toBe(1);
      expect(estado.plazasLibres).toBe(2);
      expect(estado.confirmados).toHaveLength(1);
      expect(estado.confirmados[0].apodo).toBe('FishPro');
    });

    it('registra Llegada tardía con hora obligatoria sin alterar el efecto sobre el Cupo', async () => {
      const resultado = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '622222222',
        apodo: 'Tardón',
        llegadaTardia: true,
        horaEstimadaLlegada: '22:30',
      });

      expect(resultado.tipo).toBe('confirmado');
      if (resultado.tipo === 'confirmado') {
        expect(resultado.inscripcion.llegadaTardia).toBe(true);
        expect(resultado.inscripcion.horaEstimadaLlegada).toBe('22:30');
      }

      const estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.plazasOcupadas).toBe(1);
      expect(estado.plazasLibres).toBe(2);
    });

    it('falla si llegadaTardia es true pero no se indica horaEstimadaLlegada', async () => {
      await expect(
        dominio.apuntarJugador({
          eventoId: 'ev-1',
          telefono: '622222222',
          apodo: 'TardónSinHora',
          llegadaTardia: true,
        })
      ).rejects.toThrow(DatosInscripcionInvalidosError);
    });

    it('falla si el apodo está vacío o solo contiene espacios', async () => {
      await expect(
        dominio.apuntarJugador({
          eventoId: 'ev-1',
          telefono: '622222222',
          apodo: '   ',
          llegadaTardia: false,
        })
      ).rejects.toThrow(DatosInscripcionInvalidosError);
    });
  });

  describe('Lista de espera y Evento completo', () => {
    it('con Cupo agotado entra al final de la Lista de espera con su posición', async () => {
      // Cupo es 3: llenamos las 3 plazas
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '611111111',
        apodo: 'Jugador 1',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '622222222',
        apodo: 'Jugador 2',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '633333333',
        apodo: 'Jugador 3',
        llegadaTardia: false,
      });

      // El 4º y 5º deben entrar a la lista de espera
      const res4 = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '644444444',
        apodo: 'Espera 1',
        llegadaTardia: false,
      });

      expect(res4.tipo).toBe('en_lista_de_espera');
      if (res4.tipo === 'en_lista_de_espera') {
        expect(res4.posicion).toBe(1);
        expect(res4.inscripcion.estado).toBe('en_lista_de_espera');
        expect(res4.inscripcion.posicionEspera).toBe(1);
      }

      const res5 = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '655555555',
        apodo: 'Espera 2',
        llegadaTardia: false,
      });

      expect(res5.tipo).toBe('en_lista_de_espera');
      if (res5.tipo === 'en_lista_de_espera') {
        expect(res5.posicion).toBe(2);
        expect(res5.inscripcion.posicionEspera).toBe(2);
      }

      const estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.plazasOcupadas).toBe(3);
      expect(estado.plazasLibres).toBe(0);
      expect(estado.confirmados).toHaveLength(3);
      expect(estado.listaEspera).toHaveLength(2);
      expect(estado.listaEspera[0].apodo).toBe('Espera 1');
      expect(estado.listaEspera[1].apodo).toBe('Espera 2');
    });

    it('con espera desactivada y Cupo lleno devuelve "Evento completo" y no entra en cola', async () => {
      const eventoSinEspera: Evento = {
        ...eventoBase,
        id: 'ev-sin-espera',
        cupo: 1,
        permiteListaEspera: false,
      };
      await repo.guardarEvento(eventoSinEspera);

      await dominio.apuntarJugador({
        eventoId: 'ev-sin-espera',
        telefono: '611111111',
        apodo: 'Unico',
        llegadaTardia: false,
      });

      const resSegundo = await dominio.apuntarJugador({
        eventoId: 'ev-sin-espera',
        telefono: '622222222',
        apodo: 'QuedaFuera',
        llegadaTardia: false,
      });

      expect(resSegundo.tipo).toBe('evento_completo');

      const estado = await dominio.obtenerEstadoEvento('ev-sin-espera');
      expect(estado.plazasOcupadas).toBe(1);
      expect(estado.plazasLibres).toBe(0);
      expect(estado.confirmados).toHaveLength(1);
      expect(estado.listaEspera).toHaveLength(0);
    });
  });

  describe('Deduplicación por teléfono', () => {
    it('permite máx. una inscripción activa por teléfono/evento y devuelve la existente en caso de duplicado', async () => {
      const primera = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '612345678',
        apodo: 'Original',
        llegadaTardia: false,
      });
      expect(primera.tipo).toBe('confirmado');

      // Intentar inscribirse de nuevo con el mismo teléfono (incluso con distinto formato de entrada)
      const segunda = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '+34 612 34 56 78',
        apodo: 'IntentoDuplicado',
        llegadaTardia: true,
        horaEstimadaLlegada: '23:00',
      });

      expect(segunda.tipo).toBe('ya_inscrito');
      if (segunda.tipo === 'ya_inscrito') {
        expect(segunda.duplicada).toBe(true);
        expect(segunda.inscripcion.id).toBe(
          primera.tipo === 'confirmado' ? primera.inscripcion.id : ''
        );
        expect(segunda.inscripcion.apodo).toBe('Original'); // Los datos originales no cambian
      }

      // No se crean nuevas inscripciones ni se alteran las plazas
      const estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.plazasOcupadas).toBe(1);
      expect(estado.confirmados).toHaveLength(1);
    });

    it('devuelve la inscripción existente sin alterar la cola si el jugador ya está en lista de espera', async () => {
      // Llenamos el cupo
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '611111111',
        apodo: 'P1',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '622222222',
        apodo: 'P2',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '633333333',
        apodo: 'P3',
        llegadaTardia: false,
      });

      // Entra en espera en puesto #1
      const espera = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '644444444',
        apodo: 'EnEspera',
        llegadaTardia: false,
      });
      expect(espera.tipo).toBe('en_lista_de_espera');

      // Intenta registrarse de nuevo con el mismo teléfono
      const reintento = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '644444444',
        apodo: 'OtroApodo',
        llegadaTardia: false,
      });

      expect(reintento.tipo).toBe('ya_inscrito');
      if (reintento.tipo === 'ya_inscrito') {
        expect(reintento.duplicada).toBe(true);
        expect(reintento.inscripcion.posicionEspera).toBe(1);
        expect(reintento.inscripcion.apodo).toBe('EnEspera');
      }

      const estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.listaEspera).toHaveLength(1);
      expect(estado.listaEspera[0].posicionEspera).toBe(1);
    });

    it('no permite registrarse si el evento está cancelado', async () => {
      const evCancelado: Evento = {
        ...eventoBase,
        id: 'ev-cancelado',
        estado: 'cancelado',
      };
      await repo.guardarEvento(evCancelado);

      await expect(
        dominio.apuntarJugador({
          eventoId: 'ev-cancelado',
          telefono: '612345678',
          apodo: 'Inocente',
          llegadaTardia: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('Cancelación y Reinscripción', () => {
    it('registra la cancelación con atribución del Jugador', async () => {
      const alta = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '612345678',
        apodo: 'Player1',
        llegadaTardia: false,
      });

      if (alta.tipo !== 'confirmado') throw new Error('Se esperaba confirmado');

      const resCancel = await dominio.cancelarInscripcion({
        eventoId: 'ev-1',
        inscripcionId: alta.inscripcion.id,
        canceladoPor: 'jugador',
      });

      expect(resCancel.inscripcionCancelada.estado).toBe('cancelado');
      expect(resCancel.inscripcionCancelada.canceladoPor).toBe('jugador');

      const estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.plazasOcupadas).toBe(0);
      expect(estado.plazasLibres).toBe(3);
      expect(estado.confirmados).toHaveLength(0);
      expect(estado.cancelados).toHaveLength(1);
      expect(estado.cancelados[0].canceladoPor).toBe('jugador');
    });

    it('registra la cancelación con atribución del Organizador', async () => {
      const alta = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '612345678',
        apodo: 'Player1',
        llegadaTardia: false,
      });

      if (alta.tipo !== 'confirmado') throw new Error('Se esperaba confirmado');

      const resCancel = await dominio.cancelarInscripcion({
        eventoId: 'ev-1',
        inscripcionId: alta.inscripcion.id,
        canceladoPor: 'organizador',
      });

      expect(resCancel.inscripcionCancelada.estado).toBe('cancelado');
      expect(resCancel.inscripcionCancelada.canceladoPor).toBe('organizador');

      const estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.cancelados[0].canceladoPor).toBe('organizador');
    });

    it('permite la reinscripción tras cancelar: crea nueva inscripción y no recupera puesto previo', async () => {
      // Llenamos el cupo (3 plazas)
      const p1 = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '611111111',
        apodo: 'P1',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '622222222',
        apodo: 'P2',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '633333333',
        apodo: 'P3',
        llegadaTardia: false,
      });

      if (p1.tipo !== 'confirmado') throw new Error('Se esperaba confirmado');

      // P1 cancela su inscripción
      await dominio.cancelarInscripcion({
        eventoId: 'ev-1',
        inscripcionId: p1.inscripcion.id,
        canceladoPor: 'jugador',
      });

      // Hay 2 plazas ocupadas y 1 libre. P1 se reinscribe con el mismo teléfono
      const reinscripcion = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '611111111',
        apodo: 'P1 de nuevo',
        llegadaTardia: false,
      });

      expect(reinscripcion.tipo).toBe('confirmado');
      if (reinscripcion.tipo === 'confirmado') {
        expect(reinscripcion.duplicada).toBe(false);
        expect(reinscripcion.inscripcion.id).not.toBe(p1.inscripcion.id); // Nueva entidad
        expect(reinscripcion.inscripcion.estado).toBe('confirmado');
      }

      const estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.confirmados).toHaveLength(3);
      expect(estado.cancelados).toHaveLength(1); // El registro cancelado se conserva
    });

    it('si el evento está lleno con lista de espera, la reinscripción entra al final de la lista', async () => {
      // 3 plazas ocupadas
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '611111111',
        apodo: 'P1',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '622222222',
        apodo: 'P2',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '633333333',
        apodo: 'P3',
        llegadaTardia: false,
      });

      // P4 entra en espera (posición 1)
      const p4 = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '644444444',
        apodo: 'P4',
        llegadaTardia: false,
      });
      // P5 entra en espera (posición 2)
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '655555555',
        apodo: 'P5',
        llegadaTardia: false,
      });

      if (p4.tipo !== 'en_lista_de_espera') throw new Error('Se esperaba en lista');

      // P4 cancela mientras está en espera
      await dominio.cancelarInscripcion({
        eventoId: 'ev-1',
        inscripcionId: p4.inscripcion.id,
        canceladoPor: 'jugador',
      });

      // P5 debe haber avanzado a la posición 1
      let estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.listaEspera).toHaveLength(1);
      expect(estado.listaEspera[0].apodo).toBe('P5');
      expect(estado.listaEspera[0].posicionEspera).toBe(1);

      // P4 se vuelve a apuntar: entra al final de la espera (posición 2)
      const reapunta = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '644444444',
        apodo: 'P4 Regreso',
        llegadaTardia: false,
      });

      expect(reapunta.tipo).toBe('en_lista_de_espera');
      if (reapunta.tipo === 'en_lista_de_espera') {
        expect(reapunta.posicion).toBe(2);
      }

      estado = await dominio.obtenerEstadoEvento('ev-1');
      expect(estado.listaEspera).toHaveLength(2);
      expect(estado.listaEspera[0].apodo).toBe('P5');
      expect(estado.listaEspera[1].apodo).toBe('P4 Regreso');
    });
  });

  describe('Promoción atómica (ADR-0003)', () => {
    it('al liberarse Plaza por cancelación, el primero de la espera pasa a Pendiente de confirmación ocupando su Plaza en el mismo instante', async () => {
      // 3 confirmados
      const c1 = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '611111111',
        apodo: 'C1',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '622222222',
        apodo: 'C2',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '633333333',
        apodo: 'C3',
        llegadaTardia: false,
      });

      // 2 en lista de espera
      const e1 = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '644444444',
        apodo: 'E1',
        llegadaTardia: false,
      });
      await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '655555555',
        apodo: 'E2',
        llegadaTardia: false,
      });

      if (c1.tipo !== 'confirmado' || e1.tipo !== 'en_lista_de_espera') {
        throw new Error('Estado inicial inesperado');
      }

      // C1 cancela -> libera plaza
      const resCancel = await dominio.cancelarInscripcion({
        eventoId: 'ev-1',
        inscripcionId: c1.inscripcion.id,
        canceladoPor: 'jugador',
      });

      // E1 fue promovido atómicamente a Pendiente de confirmación
      expect(resCancel.inscripcionPromovida).toBeDefined();
      expect(resCancel.inscripcionPromovida?.id).toBe(e1.inscripcion.id);
      expect(resCancel.inscripcionPromovida?.estado).toBe('pendiente_de_confirmacion');
      expect(resCancel.inscripcionPromovida?.posicionEspera).toBeUndefined();

      // Comprobación de estado observable
      const estado = await dominio.obtenerEstadoEvento('ev-1');
      // Plazas ocupadas siguen siendo 3 (2 confirmados + 1 pendiente de confirmación ocupa plaza)
      expect(estado.plazasOcupadas).toBe(3);
      expect(estado.plazasLibres).toBe(0);
      expect(estado.confirmados).toHaveLength(2);
      expect(estado.pendientesConfirmacion).toHaveLength(1);
      expect(estado.pendientesConfirmacion[0].id).toBe(e1.inscripcion.id);

      // E2 ahora es el #1 en la lista de espera
      expect(estado.listaEspera).toHaveLength(1);
      expect(estado.listaEspera[0].apodo).toBe('E2');
      expect(estado.listaEspera[0].posicionEspera).toBe(1);
    });

    it('si un jugador en Pendiente de confirmación cancela su inscripción, libera la plaza y promueve al siguiente de la espera', async () => {
      // 1 cupo, 1 confirmado, 2 en espera
      const ev1: Evento = { ...eventoBase, id: 'ev-promo-pending-cancel', cupo: 1 };
      await repo.guardarEvento(ev1);

      const c1 = await dominio.apuntarJugador({
        eventoId: 'ev-promo-pending-cancel',
        telefono: '611111111',
        apodo: 'C1',
        llegadaTardia: false,
      });
      const e1 = await dominio.apuntarJugador({
        eventoId: 'ev-promo-pending-cancel',
        telefono: '622222222',
        apodo: 'E1',
        llegadaTardia: false,
      });
      const e2 = await dominio.apuntarJugador({
        eventoId: 'ev-promo-pending-cancel',
        telefono: '633333333',
        apodo: 'E2',
        llegadaTardia: false,
      });

      if (c1.tipo !== 'confirmado' || e1.tipo !== 'en_lista_de_espera') {
        throw new Error('Estado inicial inesperado');
      }

      // C1 cancela -> E1 pasa a pendiente de confirmación
      await dominio.cancelarInscripcion({
        eventoId: 'ev-promo-pending-cancel',
        inscripcionId: c1.inscripcion.id,
        canceladoPor: 'jugador',
      });

      // E1 (pendiente de confirmación) decide que no puede ir y cancela por su cuenta
      const resCancelPendiente = await dominio.cancelarInscripcion({
        eventoId: 'ev-promo-pending-cancel',
        inscripcionId: e1.inscripcion.id,
        canceladoPor: 'jugador',
      });

      expect(resCancelPendiente.inscripcionCancelada.estado).toBe('cancelado');
      expect(resCancelPendiente.inscripcionCancelada.canceladoPor).toBe('jugador');

      // E2 es promovido a pendiente de confirmación
      expect(resCancelPendiente.inscripcionPromovida).toBeDefined();
      expect(resCancelPendiente.inscripcionPromovida?.apodo).toBe('E2');
      expect(resCancelPendiente.inscripcionPromovida?.id).toBe(
        e2.tipo === 'en_lista_de_espera' ? e2.inscripcion.id : ''
      );
      expect(resCancelPendiente.inscripcionPromovida?.estado).toBe('pendiente_de_confirmacion');

      const estado = await dominio.obtenerEstadoEvento('ev-promo-pending-cancel');
      expect(estado.plazasOcupadas).toBe(1);
      expect(estado.pendientesConfirmacion).toHaveLength(1);
      expect(estado.pendientesConfirmacion[0].apodo).toBe('E2');
      expect(estado.listaEspera).toHaveLength(0);
    });
  });

  describe('Resolución de Pendiente de confirmación (Organizador)', () => {
    it('confirmar pendiente pasa a Confirmado sin alterar plazas ni promover a nadie más', async () => {
      // 1 cupo, 1 confirmado, 1 en espera
      const ev1Cupo: Evento = { ...eventoBase, id: 'ev-1-cupo', cupo: 1 };
      await repo.guardarEvento(ev1Cupo);

      const c1 = await dominio.apuntarJugador({
        eventoId: 'ev-1-cupo',
        telefono: '611111111',
        apodo: 'C1',
        llegadaTardia: false,
      });
      const e1 = await dominio.apuntarJugador({
        eventoId: 'ev-1-cupo',
        telefono: '622222222',
        apodo: 'E1',
        llegadaTardia: false,
      });

      if (c1.tipo !== 'confirmado' || e1.tipo !== 'en_lista_de_espera') {
        throw new Error('Estado inicial inesperado');
      }

      // C1 cancela -> E1 queda pendiente de confirmación
      await dominio.cancelarInscripcion({
        eventoId: 'ev-1-cupo',
        inscripcionId: c1.inscripcion.id,
        canceladoPor: 'jugador',
      });

      let estado = await dominio.obtenerEstadoEvento('ev-1-cupo');
      expect(estado.pendientesConfirmacion).toHaveLength(1);
      expect(estado.confirmados).toHaveLength(0);
      expect(estado.plazasOcupadas).toBe(1);

      // Organizador confirma al promovido
      const insConfirmada = await dominio.confirmarPendiente({
        eventoId: 'ev-1-cupo',
        inscripcionId: e1.inscripcion.id,
      });

      expect(insConfirmada.estado).toBe('confirmado');

      estado = await dominio.obtenerEstadoEvento('ev-1-cupo');
      expect(estado.confirmados).toHaveLength(1);
      expect(estado.confirmados[0].id).toBe(e1.inscripcion.id);
      expect(estado.pendientesConfirmacion).toHaveLength(0);
      expect(estado.plazasOcupadas).toBe(1);
      expect(estado.plazasLibres).toBe(0);
    });

    it('rechazar pendiente pasa a Cancelado por Organizador y promueve al siguiente según el orden vigente', async () => {
      // 1 cupo, 1 confirmado, 2 en espera (E1, E2)
      const ev1Cupo: Evento = { ...eventoBase, id: 'ev-rechazo', cupo: 1 };
      await repo.guardarEvento(ev1Cupo);

      const c1 = await dominio.apuntarJugador({
        eventoId: 'ev-rechazo',
        telefono: '611111111',
        apodo: 'C1',
        llegadaTardia: false,
      });
      const e1 = await dominio.apuntarJugador({
        eventoId: 'ev-rechazo',
        telefono: '622222222',
        apodo: 'E1',
        llegadaTardia: false,
      });
      const e2 = await dominio.apuntarJugador({
        eventoId: 'ev-rechazo',
        telefono: '633333333',
        apodo: 'E2',
        llegadaTardia: false,
      });

      if (c1.tipo !== 'confirmado' || e1.tipo !== 'en_lista_de_espera') {
        throw new Error('Estado inicial inesperado');
      }

      // C1 cancela -> E1 queda pendiente de confirmación
      await dominio.cancelarInscripcion({
        eventoId: 'ev-rechazo',
        inscripcionId: c1.inscripcion.id,
        canceladoPor: 'jugador',
      });

      // Organizador rechaza a E1 (p. ej. porque llega tarde y prefiere priorizar al siguiente)
      const resRechazo = await dominio.rechazarPendiente({
        eventoId: 'ev-rechazo',
        inscripcionId: e1.inscripcion.id,
      });

      expect(resRechazo.inscripcionRechazada.estado).toBe('cancelado');
      expect(resRechazo.inscripcionRechazada.canceladoPor).toBe('organizador');

      // E2 debe haber sido promovido atómicamente a pendiente de confirmación
      expect(resRechazo.inscripcionPromovida).toBeDefined();
      expect(resRechazo.inscripcionPromovida?.id).toBe(
        e2.tipo === 'en_lista_de_espera' ? e2.inscripcion.id : ''
      );
      expect(resRechazo.inscripcionPromovida?.estado).toBe('pendiente_de_confirmacion');

      const estado = await dominio.obtenerEstadoEvento('ev-rechazo');
      expect(estado.plazasOcupadas).toBe(1);
      expect(estado.pendientesConfirmacion).toHaveLength(1);
      expect(estado.pendientesConfirmacion[0].apodo).toBe('E2');
      expect(estado.listaEspera).toHaveLength(0);
      expect(estado.cancelados).toHaveLength(2); // C1 y E1
    });

    it('falla si se intenta confirmar o rechazar una inscripción que no está pendiente de confirmación', async () => {
      const c1 = await dominio.apuntarJugador({
        eventoId: 'ev-1',
        telefono: '611111111',
        apodo: 'C1',
        llegadaTardia: false,
      });

      if (c1.tipo !== 'confirmado') throw new Error('Se esperaba confirmado');

      await expect(
        dominio.confirmarPendiente({
          eventoId: 'ev-1',
          inscripcionId: c1.inscripcion.id,
        })
      ).rejects.toThrow();

      await expect(
        dominio.rechazarPendiente({
          eventoId: 'ev-1',
          inscripcionId: c1.inscripcion.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('Reordenación de la Lista de espera (Organizador)', () => {
    it('permite reordenar la lista de espera actualizando las posiciones', async () => {
      // Cupo 1: 1 confirmado, 3 en espera (A, B, C)
      const evReorden: Evento = { ...eventoBase, id: 'ev-reorden', cupo: 1 };
      await repo.guardarEvento(evReorden);

      await dominio.apuntarJugador({
        eventoId: 'ev-reorden',
        telefono: '600000000',
        apodo: 'Confirmado',
        llegadaTardia: false,
      });
      const insA = await dominio.apuntarJugador({
        eventoId: 'ev-reorden',
        telefono: '611111111',
        apodo: 'Espera A',
        llegadaTardia: false,
      });
      const insB = await dominio.apuntarJugador({
        eventoId: 'ev-reorden',
        telefono: '622222222',
        apodo: 'Espera B',
        llegadaTardia: false,
      });
      const insC = await dominio.apuntarJugador({
        eventoId: 'ev-reorden',
        telefono: '633333333',
        apodo: 'Espera C',
        llegadaTardia: false,
      });

      if (
        insA.tipo !== 'en_lista_de_espera' ||
        insB.tipo !== 'en_lista_de_espera' ||
        insC.tipo !== 'en_lista_de_espera'
      ) {
        throw new Error('Se esperaban en espera');
      }

      // Orden actual: [A(#1), B(#2), C(#3)]
      // El organizador reordena a: [C(#1), A(#2), B(#3)]
      const nuevoOrden = [
        insC.inscripcion.id,
        insA.inscripcion.id,
        insB.inscripcion.id,
      ];

      const listaReordenada = await dominio.reordenarListaEspera({
        eventoId: 'ev-reorden',
        nuevoOrdenInscripcionIds: nuevoOrden,
      });

      expect(listaReordenada[0].id).toBe(insC.inscripcion.id);
      expect(listaReordenada[0].posicionEspera).toBe(1);
      expect(listaReordenada[1].id).toBe(insA.inscripcion.id);
      expect(listaReordenada[1].posicionEspera).toBe(2);
      expect(listaReordenada[2].id).toBe(insB.inscripcion.id);
      expect(listaReordenada[2].posicionEspera).toBe(3);

      // Verificamos que si se libera una plaza, el primero promovido es C (el nuevo #1)
      const cancelConfirmado = await repo.listarInscripcionesPorEvento('ev-reorden');
      const confirmado = cancelConfirmado.find((i) => i.estado === 'confirmado');
      if (!confirmado) throw new Error('Falta confirmado');

      const resPromo = await dominio.cancelarInscripcion({
        eventoId: 'ev-reorden',
        inscripcionId: confirmado.id,
        canceladoPor: 'organizador',
      });

      expect(resPromo.inscripcionPromovida?.id).toBe(insC.inscripcion.id);
      expect(resPromo.inscripcionPromovida?.apodo).toBe('Espera C');
    });

    it('rechaza reordenar si la lista de IDs no coincide exactamente con las inscripciones en espera activas', async () => {
      const evReorden: Evento = { ...eventoBase, id: 'ev-reorden-val', cupo: 1 };
      await repo.guardarEvento(evReorden);

      await dominio.apuntarJugador({
        eventoId: 'ev-reorden-val',
        telefono: '600000000',
        apodo: 'Confirmado',
        llegadaTardia: false,
      });
      const insA = await dominio.apuntarJugador({
        eventoId: 'ev-reorden-val',
        telefono: '611111111',
        apodo: 'A',
        llegadaTardia: false,
      });

      if (insA.tipo !== 'en_lista_de_espera') throw new Error('Esperaba en espera');

      // Intentar reordenar con un ID inventado o lista vacía
      await expect(
        dominio.reordenarListaEspera({
          eventoId: 'ev-reorden-val',
          nuevoOrdenInscripcionIds: ['id-inexistente'],
        })
      ).rejects.toThrow();

      await expect(
        dominio.reordenarListaEspera({
          eventoId: 'ev-reorden-val',
          nuevoOrdenInscripcionIds: [],
        })
      ).rejects.toThrow();
    });
  });
});
