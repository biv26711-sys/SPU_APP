
import { useEffect, useMemo, useRef, useState } from 'react';
import StickyPhaseHeader from "@/components/StickyPhaseHeader.jsx";

export default function TaskNameSuggest({ value, onSelect }) {
  const [q, setQ] = useState(value || '');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => setQ(value || ''), [value]);

  useEffect(() => {
    let stop = false;
    const id = setTimeout(async () => {
      try {
        const res = await window.api?.templates?.search?.(q) || [];
        if (!stop) setItems(res);
      } catch (e) {
        console.warn('search error', e);
      }
    }, 200);
    return () => { stop = true; clearTimeout(id); };
  }, [q]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const grouped = useMemo(() => {
    const out = [];
    let lastPhase = null;
    for (const it of items) {
      if (it.phase_id !== lastPhase) {
        out.push({ _type: 'phase', id: `phase-${it.phase_id}`, title: it.phase_title });
        lastPhase = it.phase_id;
      }
      out.push({ _type: 'item', ...it });
    }
    return out;
  }, [items]);

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="w-full h-10 rounded-md border px-3 text-sm"
        placeholder="Начните печатать..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border bg-background shadow">
          {grouped.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</div>
          ) : (
            <ul className="py-1 text-sm">
              {grouped.map((row) => {
                if (row._type === 'phase') {
                  return (
                    <li key={row.id}>
                      <StickyPhaseHeader title={row.title} />
                    </li>
                  );
                }
                return (
                  <li
                    key={row.id}
                    className="cursor-pointer px-3 py-2 hover:bg-muted"
                    title={row.description || ''}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      try {
                        const required = await window.api?.templates?.requiredFor?.(row.id) ?? [];
                        onSelect?.({ template: row, required });
                      } catch (e) {
                        console.warn('failed to load required deps', e);
                        onSelect?.({ template: row, required: [] });
                      } finally {
                        setOpen(false);
                      }
                    }}
                  >
                    <div className="font-medium">{row.name}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


