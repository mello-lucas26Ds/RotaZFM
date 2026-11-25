import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ContractValidationError,
  assertIavQuery,
  assertLoadProfile,
  validateIavQuery,
  validateLoadProfile,
} from '../src/index.js';

const REFERENCE_DATE = '2026-11-23';

function validQuery(overrides = {}) {
  return {
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: '2026-11-25',
    carga: {
      tipo: 'SECA',
      peso_bruto_total_kg: 10000,
    },
    ...overrides,
  };
}

test('C01 contracts: aceita IavQuery válido e assume quantidade_caminhoes = 1', () => {
  const result = validateIavQuery(validQuery(), { referenceDate: REFERENCE_DATE });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: '2026-11-25',
    carga: {
      tipo: 'SECA',
      peso_bruto_total_kg: 10000,
      quantidade_caminhoes: 1,
    },
  });
});

test('contracts: aceita par origem/destino fora do catálogo para o domínio decidir rota', () => {
  const result = validateIavQuery(validQuery({ origem: 'BELEM' }), {
    referenceDate: REFERENCE_DATE,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.origem, 'BELEM');
  assert.equal(result.value.destino, 'SAO_PAULO');
});

test('C09 contracts: rejeita campo extra na raiz e dentro de carga', () => {
  const rootExtra = validateIavQuery(validQuery({ agente: 'teste' }), {
    referenceDate: REFERENCE_DATE,
  });
  assert.equal(rootExtra.ok, false);
  assert.ok(rootExtra.errors.some((error) => error.code === 'EXTRA_FIELD' && error.path === 'query.agente'));

  const cargaExtra = validateIavQuery(
    validQuery({ carga: { tipo: 'SECA', peso_bruto_total_kg: 10000, eixo: 3 } }),
    { referenceDate: REFERENCE_DATE },
  );
  assert.equal(cargaExtra.ok, false);
  assert.ok(
    cargaExtra.errors.some(
      (error) => error.code === 'EXTRA_FIELD' && error.path === 'carga.eixo',
    ),
  );
});

test('C10 contracts: rejeita data_embarque fora da janela hoje..hoje+4', () => {
  for (const dataEmbarque of ['2026-11-20', '2026-11-28', '25/11/2026', '2026-02-30']) {
    const result = validateIavQuery(validQuery({ data_embarque: dataEmbarque }), {
      referenceDate: REFERENCE_DATE,
    });
    assert.equal(result.ok, false, dataEmbarque);
  }

  assert.equal(
    validateIavQuery(validQuery({ data_embarque: '2026-11-27' }), {
      referenceDate: REFERENCE_DATE,
    }).ok,
    true,
  );
});

test('contracts: janela de data_embarque usa hoje em America/Manaus', () => {
  const referenceDate = new Date('2026-11-24T01:00:00.000Z');

  assert.equal(
    validateIavQuery(validQuery({ data_embarque: '2026-11-23' }), { referenceDate }).ok,
    true,
  );
  assert.equal(
    validateIavQuery(validQuery({ data_embarque: '2026-11-28' }), { referenceDate }).ok,
    false,
  );
});

test('C11 contracts: rejeita peso bruto fora de 1..60000 ou não inteiro', () => {
  for (const peso of [0, 60001, 10.5, '10000', null]) {
    const result = validateLoadProfile({ tipo: 'SECA', peso_bruto_total_kg: peso });
    assert.equal(result.ok, false, String(peso));
  }

  assert.equal(validateLoadProfile({ tipo: 'SECA', peso_bruto_total_kg: 1 }).ok, true);
  assert.equal(validateLoadProfile({ tipo: 'SECA', peso_bruto_total_kg: 60000 }).ok, true);
});

test('contracts: valida enum de carga e rejeita tipo desconhecido', () => {
  assert.equal(validateLoadProfile({ tipo: 'GRANEL', peso_bruto_total_kg: 1000 }).ok, false);
  assert.equal(validateLoadProfile({ tipo: 'CONTEINERIZADA', peso_bruto_total_kg: 1000 }).ok, true);
});

test('contracts: assert lança ContractValidationError com code INVALID_QUERY', () => {
  assert.throws(
    () => assertIavQuery(validQuery({ carga: { tipo: 'SECA', peso_bruto_total_kg: 0 } }), {
      referenceDate: REFERENCE_DATE,
    }),
    (error) => error instanceof ContractValidationError && error.code === 'INVALID_QUERY',
  );

  assert.throws(
    () => assertLoadProfile({ tipo: 'SECA' }),
    (error) => error instanceof ContractValidationError && error.code === 'INVALID_LOAD_PROFILE',
  );
});
