import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { Card, ErrorNote, Field, PageHead, useData } from '../ui';

export function Configuracoes() {
  const { data: settings, reload } = useData<any[]>(() => db.list('settings'), []);
  const [whatsapp, setWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    const row = (settings ?? []).find((s) => s.key === 'whatsapp');
    if (row) setWhatsapp(row.value ?? '');
  }, [settings]);

  const catalogUrl = `${window.location.origin}${window.location.pathname}#/catalogo`;
  const digits = whatsapp.replace(/\D/g, '');

  async function save() {
    setSaving(true);
    setErr('');
    setOk('');
    try {
      const row = (settings ?? []).find((s) => s.key === 'whatsapp');
      if (row) await db.update('settings', row.key, { value: whatsapp });
      else await db.insert('settings', { key: 'whatsapp', value: whatsapp });
      setOk('Configuração salva!');
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead title='Configurações' sub='Integrações e dados do sistema' />
      <ErrorNote message={err} />
      <Card title='Catálogo digital e WhatsApp'>
        <div className='form-grid'>
          <Field label='WhatsApp da loja (com DDI e DDD)'>
            <input
              className='input'
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder='Ex.: 5511999998888'
            />
          </Field>
        </div>
        <p className='muted'>
          Este número recebe os pedidos do catálogo digital. Use o formato com código do país:
          55 + DDD + número.
        </p>
        {digits.length >= 10 && digits.length <= 13 ? (
          <p className='muted'>
            Teste: <a href={`https://wa.me/${digits}`} target='_blank' rel='noreferrer'>abrir conversa</a>
          </p>
        ) : (
          whatsapp.length > 0 && <p className='muted'>Número incompleto — inclua 55 + DDD + número.</p>
        )}
        <div className='btn-row'>
          <button className='btn btn--primary' disabled={saving} onClick={save}>
            {saving ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </div>
        {ok && <p className='ok-note'>{ok}</p>}
      </Card>

      <Card title='Link do catálogo digital'>
        <p className='muted'>
          Compartilhe este link com seus clientes. O catálogo mostra os produtos ativos cadastrados
          no sistema, com preços e botão de pedido pelo WhatsApp.
        </p>
        <div className='input-group'>
          <input className='input' readOnly value={catalogUrl} />
          <button
            className='btn'
            onClick={() => {
              void navigator.clipboard?.writeText(catalogUrl);
              setOk('Link copiado!');
            }}
          >
            Copiar
          </button>
        </div>
        <a className='btn-link' href={catalogUrl} target='_blank' rel='noreferrer'>
          Abrir catálogo em nova aba →
        </a>
      </Card>
    </>
  );
}
