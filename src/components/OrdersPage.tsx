import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { CatalogueItem, Order, ORDER_STATUS, rands, missingTable, notifyStaff } from '@/lib/franchiseePortal';
import { Spinner, Modal } from './DeclarationsPage';
import { ShoppingCart, Plus, Minus, Loader2, Trash2, Package } from 'lucide-react';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

/** Orders from Head Office: invoice books, clothing, marketing material. */
const OrdersPage: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'franchisee') {
    return user.franchiseeId ? <FranchiseeOrders franchiseeId={user.franchiseeId} /> : <div className="p-8 text-gray-500">No franchise record is linked to your account yet. Please contact Head Office.</div>;
  }
  return <StaffOrders />;
};

type CartKey = string; // item_id|size
interface CartLine { item: CatalogueItem; size: string; qty: number }

const FranchiseeOrders: React.FC<{ franchiseeId: string }> = ({ franchiseeId }) => {
  const { user } = useAuth();
  const { franchisees } = useData();
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<CartKey, CartLine>>({});
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    const [c, o] = await Promise.all([
      supabase.from('order_catalogue').select('*').eq('active', true).order('position'),
      supabase.from('orders').select('*').eq('franchisee_id', franchiseeId).order('created_at', { ascending: false }),
    ]);
    const e = c.error || o.error;
    if (e) setErr(missingTable(e.message) ? 'Ordering is not switched on yet. Please contact Head Office.' : e.message);
    setItems((c.data || []) as CatalogueItem[]);
    setOrders((o.data || []) as Order[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [franchiseeId]);

  const cats = useMemo(() => {
    const m = new Map<string, CatalogueItem[]>();
    items.forEach(i => m.set(i.category, [...(m.get(i.category) || []), i]));
    return [...m.entries()];
  }, [items]);

  const add = (i: CatalogueItem, delta: number) => {
    const size = i.sizes.length ? sizes[i.id] || '' : '';
    if (i.sizes.length && !size) { alert('Choose a size first.'); return; }
    const k = `${i.id}|${size}`;
    setCart(c => {
      const qty = Math.max(0, (c[k]?.qty || 0) + delta);
      const n = { ...c };
      if (qty === 0) delete n[k]; else n[k] = { item: i, size, qty };
      return n;
    });
  };
  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + (l.item.price_excl || 0) * l.qty, 0);
  const unpriced = lines.some(l => l.item.price_excl === null);

  const place = async () => {
    if (!lines.length) return;
    setBusy(true); setErr('');
    const { data, error } = await supabase.from('orders').insert({
      franchisee_id: franchiseeId, notes: notes || null, ordered_by: user?.name || null,
      items: lines.map(l => ({ item_id: l.item.id, size: l.size || null, qty: l.qty })),
    }).select().single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const o = data as Order;
    const fname = franchisees.find(f => f.id === franchiseeId)?.name || user?.name || '';
    notifyStaff('order_submitted', {
      franchisee_name: fname, order_no: String(o.order_no), total: rands(o.total_excl, true), notes: o.notes || '—',
      items: o.items.map(l => `${l.qty} × ${l.name}${l.size ? ` (${l.size})` : ''}`).join('\n'),
    });
    setCart({}); setNotes(''); setDone(`Order #${o.order_no} placed. Head Office has been notified.`);
    load();
  };

  const cancel = async (o: Order) => {
    if (!confirm(`Cancel order #${o.order_no}?`)) return;
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', o.id);
    if (error) alert(error.message); else load();
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Order from Head Office</h1>
      <p className="text-gray-600 mt-1">Invoice books, clothing and marketing material. Prices exclude VAT and delivery; Head Office invoices you when the order is prepared.</p>
      {err && <p className="mt-4 text-red-700">{err}</p>}
      {done && <p className="mt-4 p-3 rounded-lg bg-green-50 text-green-800 text-sm">{done}</p>}
      {loading ? <Spinner /> : (
        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {cats.map(([cat, list]) => (
              <div key={cat}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{cat}</h2>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {list.map(i => {
                    const size = i.sizes.length ? sizes[i.id] || '' : '';
                    const inCart = Object.values(cart).filter(l => l.item.id === i.id).reduce((s, l) => s + l.qty, 0);
                    return (
                      <div key={i.id} className="p-3 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px]">
                          <div className="font-medium text-gray-900">{i.name}</div>
                          <div className="text-xs text-gray-500">{i.price_excl === null ? 'Price on invoice' : `${rands(i.price_excl, true)} per ${i.unit}`}{i.description ? ` · ${i.description}` : ''}</div>
                        </div>
                        {i.sizes.length > 0 && (
                          <select value={size} onChange={e => setSizes(s => ({ ...s, [i.id]: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                            <option value="">Size…</option>
                            {i.sizes.map(s => <option key={s}>{s}</option>)}
                          </select>
                        )}
                        <div className="flex items-center gap-1">
                          <button onClick={() => add(i, -1)} className="p-1.5 rounded border border-gray-200"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-8 text-center text-sm font-semibold">{cart[`${i.id}|${size}`]?.qty || 0}</span>
                          <button onClick={() => add(i, 1)} className="p-1.5 rounded border border-gray-200"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                        {inCart > 0 && i.sizes.length > 0 && <span className="text-xs text-gray-500">{inCart} in order</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4">
              <div className="font-semibold flex items-center gap-2 mb-3"><ShoppingCart className="h-4 w-4" /> Your order</div>
              {lines.length === 0 ? <p className="text-sm text-gray-500">Nothing added yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {lines.map(l => (
                    <li key={`${l.item.id}|${l.size}`} className="flex justify-between gap-2">
                      <span>{l.qty} × {l.item.name}{l.size ? ` (${l.size})` : ''}</span>
                      <span className="whitespace-nowrap">{l.item.price_excl === null ? '—' : rands(l.item.price_excl * l.qty, true)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold"><span>Total excl. VAT</span><span>{rands(total, true)}{unpriced ? ' +' : ''}</span></div>
              {unpriced && <p className="text-xs text-gray-500 mt-1">Some items are priced on the invoice.</p>}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes (delivery address, urgency…)" className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button onClick={place} disabled={!lines.length || busy} className="mt-3 w-full bg-[#C41E3A] text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Place order</button>
            </div>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">My orders</h2>
          <OrderTable orders={orders} onCancel={cancel} />
        </div>
      )}
    </div>
  );
};

const OrderTable: React.FC<{ orders: Order[]; onCancel?: (o: Order) => void; onOpen?: (o: Order) => void; names?: (id: string) => string }> = ({ orders, onCancel, onOpen, names }) => (
  <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-3">Order</th>{names && <th className="text-left px-4 py-3">Franchisee</th>}<th className="text-left px-4 py-3">Items</th><th className="text-right px-4 py-3">Total</th><th className="text-left px-4 py-3">Status</th><th></th></tr></thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.id} className="border-t border-gray-100 align-top">
            <td className="px-4 py-3 whitespace-nowrap"><div className="font-semibold">#{o.order_no}</div><div className="text-xs text-gray-500">{fmt(o.created_at)}</div></td>
            {names && <td className="px-4 py-3">{names(o.franchisee_id)}</td>}
            <td className="px-4 py-3">{o.items.map((l, i) => <div key={i}>{l.qty} × {l.name}{l.size ? ` (${l.size})` : ''}</div>)}{o.ho_note && <div className="text-xs text-gray-600 mt-1"><b>Head Office:</b> {o.ho_note}</div>}</td>
            <td className="px-4 py-3 text-right whitespace-nowrap">{rands(o.total_excl, true)}</td>
            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ORDER_STATUS[o.status].cls}`}>{ORDER_STATUS[o.status].label}</span></td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              {onCancel && o.status === 'submitted' && <button onClick={() => onCancel(o)} className="text-gray-500 hover:text-red-600 text-xs font-semibold">Cancel</button>}
              {onOpen && <button onClick={() => onOpen(o)} className="text-[#C41E3A] font-semibold hover:underline">Update</button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ---------------------------------------------------------------- Head Office
const StaffOrders: React.FC = () => {
  const { user } = useAuth();
  const { franchisees } = useData();
  const [tab, setTab] = useState<'orders' | 'catalogue'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<Order | null>(null);

  const load = async () => {
    setLoading(true); setErr('');
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300);
    if (filter === 'open') q = q.in('status', ['submitted', 'processing', 'invoiced', 'dispatched']);
    const { data, error } = await q;
    if (error) setErr(missingTable(error.message) ? 'Run supabase/franchisee_portal.sql in Supabase first.' : error.message);
    setOrders((data || []) as Order[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);
  const name = (id: string) => franchisees.find(f => f.id === id)?.name || id;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Franchisee Orders</h1>
      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {(['orders', 'catalogue'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? 'border-[#C41E3A] text-[#C41E3A]' : 'border-transparent text-gray-500'}`}>{t === 'orders' ? 'Orders' : 'Catalogue & prices'}</button>
        ))}
      </div>
      {err && <p className="mt-4 text-red-700">{err}</p>}
      {tab === 'orders' && (
        <>
          <div className="mt-4 flex gap-3 text-sm">
            <label className="flex items-center gap-1"><input type="radio" checked={filter === 'open'} onChange={() => setFilter('open')} /> Open orders</label>
            <label className="flex items-center gap-1"><input type="radio" checked={filter === 'all'} onChange={() => setFilter('all')} /> All</label>
          </div>
          <div className="mt-4">{loading ? <Spinner /> : orders.length ? <OrderTable orders={orders} names={name} onOpen={setOpen} /> : <p className="text-gray-500">No orders.</p>}</div>
        </>
      )}
      {tab === 'catalogue' && <CatalogueEditor />}
      {open && <UpdateOrder order={open} who={user?.name || ''} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
    </div>
  );
};

const UpdateOrder: React.FC<{ order: Order; who: string; onClose: () => void; onSaved: () => void }> = ({ order, who, onClose, onSaved }) => {
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState(order.ho_note || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('orders').update({ status, ho_note: note || null, updated_by: who }).eq('id', order.id);
    setBusy(false);
    if (error) alert(error.message); else onSaved();
  };
  return (
    <Modal title={`Order #${order.order_no}`} onClose={onClose}>
      <ul className="text-sm space-y-1 mb-4">{order.items.map((l, i) => <li key={i} className="flex justify-between"><span>{l.qty} × {l.name}{l.size ? ` (${l.size})` : ''}</span><span>{l.unit_price === null ? '—' : rands(l.unit_price * l.qty, true)}</span></li>)}</ul>
      {order.notes && <p className="text-sm mb-4"><b>Franchisee's notes:</b> {order.notes}</p>}
      <label className="text-xs font-semibold text-gray-600">Status</label>
      <select value={status} onChange={e => setStatus(e.target.value as Order['status'])} className="input mb-3">
        {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <label className="text-xs font-semibold text-gray-600">Note to the franchisee (invoice number, courier waybill…)</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="input" />
      <div className="mt-4 flex justify-end"><button onClick={save} disabled={busy} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</button></div>
    </Modal>
  );
};

const CatalogueEditor: React.FC = () => {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, Partial<CatalogueItem> & { sizesText?: string }>>({});
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('order_catalogue').select('*').order('position');
    setItems((data || []) as CatalogueItem[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const v = (i: CatalogueItem, k: string) => (dirty[i.id] && k in dirty[i.id] ? (dirty[i.id] as any)[k] : k === 'sizesText' ? i.sizes.join(', ') : (i as any)[k]) ?? '';
  const set = (id: string, k: string, val: any) => setDirty(d => ({ ...d, [id]: { ...d[id], [k]: val } }));

  const saveAll = async () => {
    setBusy(true);
    for (const [id, p] of Object.entries(dirty)) {
      const patch: any = { ...p };
      if ('sizesText' in p) { patch.sizes = String(p.sizesText || '').split(',').map(s => s.trim()).filter(Boolean); delete patch.sizesText; }
      if ('price_excl' in p) patch.price_excl = (p.price_excl as any) === '' ? null : Number(p.price_excl);
      const { error } = await supabase.from('order_catalogue').update(patch).eq('id', id);
      if (error) { alert(error.message); break; }
    }
    setBusy(false); setDirty({}); load();
  };
  const addItem = async () => {
    const { error } = await supabase.from('order_catalogue').insert({ name: 'New item', category: 'Stationery', position: (items[items.length - 1]?.position || 0) + 10 });
    if (error) alert(error.message); else load();
  };
  const remove = async (i: CatalogueItem) => {
    if (!confirm(`Remove "${i.name}"? Past orders keep their copy. (To hide it for now, untick Active instead.)`)) return;
    const { error } = await supabase.from('order_catalogue').delete().eq('id', i.id);
    if (error) alert(error.message); else load();
  };

  if (loading) return <Spinner />;
  return (
    <div className="mt-5">
      <p className="text-sm text-gray-600 mb-3">Prices exclude VAT. Leave the price empty to show "Price on invoice". Sizes are separated by commas; leave empty for items without sizes.</p>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Price (R)</th><th className="px-3 py-2 text-left">Sizes</th><th className="px-3 py-2">Active</th><th></th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-t border-gray-100">
                <td className="px-3 py-1.5"><input className="input w-32" value={v(i, 'category')} onChange={e => set(i.id, 'category', e.target.value)} /></td>
                <td className="px-3 py-1.5"><input className="input min-w-[220px]" value={v(i, 'name')} onChange={e => set(i.id, 'name', e.target.value)} /></td>
                <td className="px-3 py-1.5"><input className="input w-20" value={v(i, 'unit')} onChange={e => set(i.id, 'unit', e.target.value)} /></td>
                <td className="px-3 py-1.5"><input className="input w-28" type="number" step="0.01" min={0} value={v(i, 'price_excl')} onChange={e => set(i.id, 'price_excl', e.target.value)} /></td>
                <td className="px-3 py-1.5"><input className="input min-w-[180px]" value={v(i, 'sizesText')} onChange={e => set(i.id, 'sizesText', e.target.value)} /></td>
                <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={!!v(i, 'active')} onChange={e => set(i.id, 'active', e.target.checked)} /></td>
                <td className="px-3 py-1.5"><button onClick={() => remove(i)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-between">
        <button onClick={addItem} className="border border-gray-300 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1"><Package className="h-4 w-4" /> Add item</button>
        <button onClick={saveAll} disabled={busy || !Object.keys(dirty).length} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</button>
      </div>
    </div>
  );
};

export default OrdersPage;
