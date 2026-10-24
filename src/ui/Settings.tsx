import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './components/Modal';
import { Button } from './components/Button';
import { exportGame, importGame, resetGame } from '../state/tick';
import { useGame } from '../state/store';
// UI-only bound for file reads; pasted saves and the parser remain unbounded.
const MAX_BACKUP_FILE_BYTES = 1024 * 1024;
export function Settings({ close }: { close: () => void }) {
  const [raw, setRaw] = useState(''),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState(false);
  const restoreResetFocus = useRef(false);
  const fileReadSequence = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = fileInput.current;
    const cancel = () => {
      fileReadSequence.current++;
      setMessage('File selection canceled. Draft unchanged.');
    };
    input?.addEventListener('cancel', cancel);
    return () => {
      input?.removeEventListener('cancel', cancel);
      fileReadSequence.current++;
    };
  }, []);
  function invalidateFileRead() {
    fileReadSequence.current++;
  }
  async function loadFile(file: File | undefined) {
    const sequence = ++fileReadSequence.current;
    if (!file) {
      setMessage('File selection canceled. Draft unchanged.');
      return;
    }
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setMessage(
        'File too large. Choose a JSON backup up to 1 MiB. Draft unchanged.',
      );
      return;
    }
    setMessage('Reading backup file…');
    try {
      const text = await file.text();
      if (sequence !== fileReadSequence.current) return;
      setRaw(text);
      setMessage(
        'File loaded as a draft. Review it, then choose Restore save to replace your street.',
      );
    } catch {
      if (sequence !== fileReadSequence.current) return;
      setMessage(
        'Could not read this file. Try again or paste your save JSON. Draft unchanged.',
      );
    }
  }
  const focusKeep = useCallback((node: HTMLSpanElement | null) => {
    node?.querySelector('button')?.focus();
  }, []);
  const focusReset = useCallback((node: HTMLButtonElement | null) => {
    if (node && restoreResetFocus.current) {
      node.focus();
      restoreResetFocus.current = false;
    }
  }, []);
  function cancelReset() {
    invalidateFileRead();
    restoreResetFocus.current = true;
    setConfirm(false);
  }
  const blocked = useGame((s) => s.storageError);
  const protectedSave = useGame((s) => s.saveProtected);
  async function copy() {
    const json = exportGame();
    if (json === null) {
      setMessage(
        'Export paused: this temporary street has not recovered your saved progress. Original raw save remains untouched. Import a valid save or reset first.',
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(json);
      setMessage('Save copied to clipboard.');
    } catch {
      const blob = new Blob([json], { type: 'application/json' }),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = 'restaurant-streets.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Save downloaded.');
    }
  }
  return (
    <Modal title="Make yourself at home" close={close}>
      <div
        onKeyDownCapture={(event) => {
          if (event.key === 'Escape' && confirm) {
            event.preventDefault();
            event.stopPropagation();
            cancelReset();
          }
        }}
      >
        <p>
          {protectedSave
            ? 'Saving is paused. Original raw save remains untouched. This temporary street has not recovered your progress. Import a valid save or explicitly reset to resume saving.'
            : 'Progress is saved in this browser every 10 seconds. Export a backup to bring your street with you.'}
        </p>
        {blocked && (
          <p role="alert">
            {protectedSave
              ? 'Browser storage is unavailable. Saved data could not be read; saving and export are paused to protect existing progress.'
              : 'Browser storage is unavailable. Keep an exported backup; progress may be lost when you close this page.'}
          </p>
        )}
        <Button onClick={copy}>Copy / download save</Button>
        <label className="import-label" htmlFor="save-file">
          Load a JSON backup file
        </label>
        <input
          ref={fileInput}
          id="save-file"
          className="save-file"
          type="file"
          accept=".json,application/json"
          aria-describedby="save-file-help"
          onClick={() => {
            invalidateFileRead();
            setMessage(
              'Choose a backup file. Your draft is unchanged until it loads.',
            );
          }}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            void loadFile(file);
          }}
        />
        <p id="save-file-help" className="fine-print">
          Up to 1 MiB per file. Loading only fills the draft below. Review it,
          then choose Restore save. You can also paste JSON.
        </p>
        <label className="import-label" htmlFor="save-import">
          Import a saved street
        </label>
        <textarea
          id="save-import"
          value={raw}
          onChange={(e) => {
            invalidateFileRead();
            setRaw(e.target.value);
            setMessage('Draft edited. Review it, then choose Restore save.');
          }}
          placeholder="Paste your save JSON here"
        />
        <p className="fine-print">
          Import replaces your street. Saved pending offline rewards are
          restored. Import adds no new earnings for time elapsed since the
          backup.
        </p>
        <Button
          className="secondary"
          disabled={!raw.trim()}
          onClick={() => {
            invalidateFileRead();
            if (importGame(raw)) {
              setMessage('Street restored.');
              setRaw('');
            } else
              setMessage(
                'Invalid or unsupported save. Your current street is unchanged.',
              );
          }}
        >
          Restore save
        </Button>
        <p role="status">{message}</p>
        <hr />
        {confirm ? (
          <>
            <p>
              Reset all coins, restaurants, gems and pending rewards? This
              cannot be undone.
            </p>
            <div className="modal-actions">
              <Button
                onClick={() => {
                  invalidateFileRead();
                  resetGame();
                  close();
                }}
              >
                Yes, start fresh
              </Button>
              <span ref={focusKeep}>
                <Button className="secondary" onClick={cancelReset}>
                  Keep my street
                </Button>
              </span>
            </div>
          </>
        ) : (
          <button
            ref={focusReset}
            className="text-button"
            onClick={() => {
              invalidateFileRead();
              setMessage(
                'Draft unchanged. Review it, then choose Restore save.',
              );
              setConfirm(true);
            }}
          >
            Reset my street
          </button>
        )}
        <div className="modal-actions">
          <Button className="secondary" onClick={close}>
            Back to the neighborhood
          </Button>
        </div>
      </div>
    </Modal>
  );
}
