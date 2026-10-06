'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { TextareaField } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';

/* ================= Toast ================= */
export type ToastType = 'ok' | 'warn' | 'err';
interface ToastItem {
  id: number;
  msg: ReactNode;
  type: ToastType;
  leaving?: boolean;
}

/* ================= Confirm ================= */
export interface ConfirmOptions {
  title: ReactNode;
  message?: ReactNode;
  desc?: ReactNode;
  confirmText?: string;
  danger?: boolean;
  /** Label kolom isian (mis. alasan). Bila diisi, promise mengembalikan teks isian. */
  input?: string;
  inputRequired?: boolean;
}
interface ConfirmState extends ConfirmOptions {
  resolve: (v: string | boolean) => void;
}

interface FeedbackCtx {
  toast: (msg: ReactNode, type?: ToastType) => void;
  /** true/teks isian bila dikonfirmasi, false bila dibatalkan. */
  confirm: (o: ConfirmOptions) => Promise<string | false | true>;
}

const Ctx = createContext<FeedbackCtx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');

  const toast = useCallback((msg: ReactNode, type: ToastType = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, type }]);
    const ttl = type === 'err' ? 5200 : 3600;
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), ttl);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl + 260);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<string | false | true>((resolve) => {
        setReason('');
        setReasonErr('');
        setConfirmState({ ...o, resolve: resolve as ConfirmState['resolve'] });
      }),
    [],
  );

  const close = (v: string | boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-root" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} style={{ transition: 'opacity .25s', opacity: t.leaving ? 0 : 1 }}>
            <Icon name={t.type === 'err' ? 'alert' : t.type === 'warn' ? 'info' : 'checkCircle'} />
            <div>{t.msg}</div>
          </div>
        ))}
      </div>
      <Modal
        open={!!confirmState}
        onClose={() => close(false)}
        title={confirmState?.title}
        desc={confirmState?.desc}
        footer={
          <>
            <Button onClick={() => close(false)}>Batal</Button>
            <Button
              variant={confirmState?.danger ? 'danger' : 'primary'}
              onClick={() => {
                if (confirmState?.input) {
                  if (confirmState.inputRequired && !reason.trim()) {
                    setReasonErr('Wajib diisi.');
                    return;
                  }
                  close(reason.trim() || ' ');
                } else close(true);
              }}
            >
              {confirmState?.confirmText || 'Lanjutkan'}
            </Button>
          </>
        }
      >
        {confirmState?.message && <p>{confirmState.message}</p>}
        {confirmState?.input && (
          <div style={{ marginTop: 12 }}>
            <TextareaField label={confirmState.input} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} error={reasonErr} />
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

export function useFeedback() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeedback harus dipakai di dalam <FeedbackProvider>.');
  return c;
}
export const useToast = () => useFeedback().toast;
export const useConfirm = () => useFeedback().confirm;
