import { describe, expect, it } from 'vitest';
import {
  extractAll, extractCpf, extractDateTime, extractDuration, extractName,
  extractPainIntensity, extractPhone, extractRecurrence, isValidCpf,
} from '../src/modules/ai/extractors';

// Quinta-feira, 17/09/2026 às 10h — fixo para as datas relativas serem determinísticas.
const NOW = new Date(2026, 8, 17, 10, 0, 0);
const DEFAULTS = { morningHour: '09:00', afternoonHour: '14:00', eveningHour: '18:00' };

describe('CPF', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(extractCpf('CPF 529.982.247-25').value).toBe('52998224725');
    expect(extractCpf('cpf 52998224725 ok').value).toBe('52998224725');
  });
  it('rejeita dígito verificador errado e repdigits, explicando o motivo', () => {
    const wrong = extractCpf('CPF 529.982.247-26');
    expect(wrong.value).toBeNull();
    expect(wrong.reason).toBe('cpf_check_digit');
    expect(extractCpf('CPF 111.111.111-11').value).toBeNull();
    expect(isValidCpf('00000000000')).toBe(false);
  });
  it('marca o trecho exato dentro da frase', () => {
    const text = 'paciente novo, CPF 529.982.247-25, ombro';
    const hit = extractCpf(text);
    expect(text.slice(hit.span![0], hit.span![1])).toBe('529.982.247-25');
  });
});

describe('telefone', () => {
  it('normaliza os formatos brasileiros para E.164', () => {
    expect(extractPhone('(11) 98765-4321').value).toBe('+5511987654321');
    expect(extractPhone('11987654321').value).toBe('+5511987654321');
    expect(extractPhone('+55 11 98765-4321').value).toBe('+5511987654321');
    expect(extractPhone('11 3255-4321').value).toBe('+551132554321');
  });
  it('rejeita DDD inexistente e celular que não começa com 9', () => {
    expect(extractPhone('(00) 98765-4321').value).toBeNull();
    expect(extractPhone('(11) 78765-4321').value).toBeNull();
  });
  it('usa o DDD padrão com confiança baixa quando ele não vem no texto', () => {
    const hit = extractPhone('98765-4321', { ddd: '11' });
    expect(hit.value).toBe('+5511987654321');
    expect(hit.confidence).toBeLessThan(0.8);
  });
  it('não engole os dígitos de um CPF (ordem dos extratores)', () => {
    const set = extractAll('Maria Silva CPF 529.982.247-25 fone 11987654321', NOW, DEFAULTS);
    expect(set.cpf.value).toBe('52998224725');
    expect(set.phone.value).toBe('+5511987654321');
  });
});

describe('data e hora', () => {
  it('resolve datas relativas em pt-BR', () => {
    expect(extractDateTime('amanhã às 14h', NOW, DEFAULTS).value).toMatchObject({ date: '2026-09-18', time: '14:00' });
    expect(extractDateTime('hoje de manhã', NOW, DEFAULTS).value).toMatchObject({ date: '2026-09-17', time: '09:00' });
    expect(extractDateTime('depois de amanhã', NOW, DEFAULTS).value?.date).toBe('2026-09-19');
    expect(extractDateTime('daqui a 3 dias', NOW, DEFAULTS).value?.date).toBe('2026-09-20');
  });
  it('trata "quinta que vem" como a quinta da semana seguinte, nunca hoje', () => {
    // NOW já é quinta 17/09; "que vem" tem de pular para 24/09.
    expect(extractDateTime('quinta que vem às 14h', NOW, DEFAULTS).value?.date).toBe('2026-09-24');
    // Sem "que vem", a próxima ocorrência do dia — hoje não conta.
    expect(extractDateTime('quinta às 14h', NOW, DEFAULTS).value?.date).toBe('2026-09-24');
    expect(extractDateTime('segunda às 8h', NOW, DEFAULTS).value?.date).toBe('2026-09-21');
  });
  it('lê datas absolutas e assume o próximo ano quando já passaram', () => {
    expect(extractDateTime('dia 20/03 às 9h', NOW, DEFAULTS).value).toMatchObject({ date: '2027-03-20', time: '09:00' });
    expect(extractDateTime('24 de dezembro', NOW, DEFAULTS).value?.date).toBe('2026-12-24');
  });
  it('converte horários falados e período do dia', () => {
    expect(extractDateTime('2 da tarde', NOW, DEFAULTS).value?.time).toBe('14:00');
    expect(extractDateTime('amanhã de noite', NOW, DEFAULTS).value).toMatchObject({ time: '18:00', partOfDay: 'noite' });
    expect(extractDateTime('às 14h30', NOW, DEFAULTS).value?.time).toBe('14:30');
    expect(extractDateTime('meio-dia', NOW, DEFAULTS).value?.time).toBe('12:00');
  });
  it('não inventa data quando o texto não tem nenhuma', () => {
    expect(extractDateTime('cadastrar paciente novo', NOW, DEFAULTS).value).toBeNull();
  });
});

describe('duração', () => {
  it('entende minutos, horas e frações', () => {
    expect(extractDuration('50 min').value).toBe(50);
    expect(extractDuration('1h').value).toBe(60);
    expect(extractDuration('1h30').value).toBe(90);
    expect(extractDuration('uma hora e meia').value).toBe(90);
    expect(extractDuration('meia hora').value).toBe(30);
  });
});

describe('recorrência', () => {
  it('extrai dias da semana e quantidade de sessões', () => {
    expect(extractRecurrence('10 sessões, terças e quintas às 14h').value)
      .toMatchObject({ weekdays: [2, 4], occurrences: 10 });
  });
  it('extrai frequência semanal', () => {
    expect(extractRecurrence('2x por semana').value).toMatchObject({ perWeek: 2 });
  });
  it('não dispara em texto sem recorrência', () => {
    expect(extractRecurrence('agendar para amanhã').value).toBeNull();
  });
});

describe('dor', () => {
  it('lê a intensidade em várias formas e respeita o intervalo 0-10', () => {
    expect(extractPainIntensity('paciente com dor 7').value).toBe(7);
    expect(extractPainIntensity('dor 8/10 no joelho').value).toBe(8);
    expect(extractPainIntensity('dor 15').value).toBeNull();
  });
});

describe('nome', () => {
  it('captura o nome após o verbo de comando', () => {
    expect(extractName('cadastrar Maria Silva').value).toBe('Maria Silva');
    expect(extractName('agendar para João da Silva').value).toBe('João da Silva');
  });
  it('ignora dias da semana e meses capitalizados', () => {
    expect(extractName('agendar Ana Paula na Segunda')?.value).toBe('Ana Paula');
  });
});

describe('extractAll', () => {
  it('extrai o comando completo e sobra só o texto livre no remainder', () => {
    const set = extractAll(
      'cadastra a Maria Silva, 11 98888-7777, maria@email.com, CPF 529.982.247-25, dor no ombro direito',
      NOW, DEFAULTS,
    );
    expect(set.cpf.value).toBe('52998224725');
    expect(set.phone.value).toBe('+5511988887777');
    expect(set.email.value).toBe('maria@email.com');
    expect(set.name.value).toBe('Maria Silva');

    // O que sobra é o que vai para o LLM: sem CPF, sem telefone, sem e-mail.
    expect(set.remainder).not.toContain('529');
    expect(set.remainder).not.toContain('98888');
    expect(set.remainder).not.toContain('@');
    expect(set.remainder).toContain('ombro');
  });

  it('mantém o remainder curto — é o que segura o contexto de 2048 tokens', () => {
    const set = extractAll('agenda 10 sessões pra Maria Silva, terças e quintas às 14h, 50 min', NOW, DEFAULTS);
    expect(set.recurrence.value).toMatchObject({ weekdays: [2, 4], occurrences: 10 });
    expect(set.datetime.value?.time).toBe('14:00');
    expect(set.durationMinutes.value).toBe(50);
    expect(set.remainder.length).toBeLessThan(40);
  });
});
