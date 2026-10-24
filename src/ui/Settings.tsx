import { useCallback, useRef, useState } from 'react';
import { Modal } from './components/Modal';
import { Button } from './components/Button';
import { exportGame, importGame, resetGame } from '../state/tick';
import { useGame } from '../state/store';
export function Settings({ close }: { close: () => void }) {
  const [raw, setRaw] = useState(''),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState(false);
  const restoreResetFocus = useRef(false);
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
        <label className="import-label" htmlFor="save-import">
          Import a saved street
        </label>
        <textarea
          id="save-import"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
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
            onClick={() => setConfirm(true)}
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
