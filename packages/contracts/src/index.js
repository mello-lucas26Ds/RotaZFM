export const LOAD_TYPES = Object.freeze(['SECA', 'CONTEINERIZADA']);
export const QUERY_ORIGINS = Object.freeze(['MANAUS']);
export const QUERY_DESTINATIONS = Object.freeze(['SAO_PAULO']);

const IAV_QUERY_FIELDS = new Set(['origem', 'destino', 'data_embarque', 'carga']);
const LOAD_PROFILE_FIELDS = new Set(['tipo', 'peso_bruto_total_kg', 'quantidade_caminhoes']);
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_WEIGHT_KG = 60000;
const MAX_SHIPPING_DATE_DAYS = 4;

export class ContractValidationError extends Error {
  constructor(message, errors, code = 'INVALID_QUERY') {
    super(message);
    this.name = 'ContractValidationError';
    this.code = code;
    this.errors = errors;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function validateNoExtraFields(value, allowedFields, path, errors) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      addError(errors, `${path}.${field}`, 'EXTRA_FIELD', `Campo não permitido: ${field}`);
    }
  }
}

function validateRequiredString(value, path, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    addError(errors, path, 'REQUIRED', `${path} é obrigatório e deve ser string não vazia`);
    return false;
  }
  return true;
}

function parseDateOnly(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function normalizeReferenceDate(referenceDate) {
  if (referenceDate instanceof Date) {
    return Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    );
  }

  if (typeof referenceDate === 'string') {
    const timestamp = parseDateOnly(referenceDate);
    if (timestamp !== null) return timestamp;
  }

  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function validateDateWindow(value, path, referenceDate, errors) {
  const shippingTimestamp = parseDateOnly(value);
  if (shippingTimestamp === null) {
    addError(errors, path, 'INVALID_DATE', `${path} deve estar no formato YYYY-MM-DD`);
    return null;
  }

  const today = normalizeReferenceDate(referenceDate);
  const maxShippingTimestamp = today + MAX_SHIPPING_DATE_DAYS * 24 * 60 * 60 * 1000;

  if (shippingTimestamp < today || shippingTimestamp > maxShippingTimestamp) {
    addError(
      errors,
      path,
      'DATE_OUT_OF_WINDOW',
      `${path} deve estar entre hoje e hoje+${MAX_SHIPPING_DATE_DAYS} dias`,
    );
    return null;
  }

  return value;
}

export function validateLoadProfile(input) {
  const errors = [];

  if (!isPlainObject(input)) {
    addError(errors, 'carga', 'INVALID_TYPE', 'carga deve ser um objeto');
    return { ok: false, errors };
  }

  validateNoExtraFields(input, LOAD_PROFILE_FIELDS, 'carga', errors);

  const tipo = input.tipo;
  if (typeof tipo !== 'string' || !LOAD_TYPES.includes(tipo)) {
    addError(
      errors,
      'carga.tipo',
      'INVALID_ENUM',
      `carga.tipo deve ser um de: ${LOAD_TYPES.join(', ')}`,
    );
  }

  const peso = input.peso_bruto_total_kg;
  if (!Number.isInteger(peso) || peso < 1 || peso > MAX_WEIGHT_KG) {
    addError(
      errors,
      'carga.peso_bruto_total_kg',
      'OUT_OF_RANGE',
      `carga.peso_bruto_total_kg deve ser inteiro entre 1 e ${MAX_WEIGHT_KG}`,
    );
  }

  let quantidadeCaminhoes = 1;
  if (input.quantidade_caminhoes !== undefined) {
    if (!Number.isInteger(input.quantidade_caminhoes) || input.quantidade_caminhoes < 1) {
      addError(
        errors,
        'carga.quantidade_caminhoes',
        'OUT_OF_RANGE',
        'carga.quantidade_caminhoes deve ser inteiro maior ou igual a 1',
      );
    } else {
      quantidadeCaminhoes = input.quantidade_caminhoes;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      tipo,
      peso_bruto_total_kg: peso,
      quantidade_caminhoes: quantidadeCaminhoes,
    },
  };
}

export function validateIavQuery(input, { referenceDate = new Date() } = {}) {
  const errors = [];

  if (!isPlainObject(input)) {
    addError(errors, 'query', 'INVALID_TYPE', 'consulta deve ser um objeto');
    return { ok: false, errors };
  }

  validateNoExtraFields(input, IAV_QUERY_FIELDS, 'query', errors);

  if (validateRequiredString(input.origem, 'origem', errors)) {
    if (!QUERY_ORIGINS.includes(input.origem)) {
      addError(errors, 'origem', 'INVALID_ENUM', `origem deve ser uma de: ${QUERY_ORIGINS.join(', ')}`);
    }
  }

  if (validateRequiredString(input.destino, 'destino', errors)) {
    if (!QUERY_DESTINATIONS.includes(input.destino)) {
      addError(
        errors,
        'destino',
        'INVALID_ENUM',
        `destino deve ser uma de: ${QUERY_DESTINATIONS.join(', ')}`,
      );
    }
  }

  let dataEmbarque = null;
  if (input.data_embarque === undefined) {
    addError(errors, 'data_embarque', 'REQUIRED', 'data_embarque é obrigatória');
  } else {
    dataEmbarque = validateDateWindow(input.data_embarque, 'data_embarque', referenceDate, errors);
  }

  let carga = null;
  if (input.carga === undefined) {
    addError(errors, 'carga', 'REQUIRED', 'carga é obrigatória');
  } else {
    const loadResult = validateLoadProfile(input.carga);
    if (!loadResult.ok) {
      errors.push(
        ...loadResult.errors.map((error) => ({
          ...error,
          path: error.path === 'carga' ? 'carga' : `carga.${error.path.replace(/^carga\./, '')}`,
        })),
      );
    } else {
      carga = loadResult.value;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      origem: input.origem,
      destino: input.destino,
      data_embarque: dataEmbarque,
      carga,
    },
  };
}

export function assertLoadProfile(input) {
  const result = validateLoadProfile(input);
  if (!result.ok) {
    throw new ContractValidationError('LoadProfile inválido', result.errors, 'INVALID_LOAD_PROFILE');
  }
  return result.value;
}

export function assertIavQuery(input, options = {}) {
  const result = validateIavQuery(input, options);
  if (!result.ok) {
    throw new ContractValidationError('IavQuery inválido', result.errors, 'INVALID_QUERY');
  }
  return result.value;
}
