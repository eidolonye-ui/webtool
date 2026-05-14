/**
 * @file ui/components/ScenarioManager.jsx
 * @description Scenario archive dropdown: create, rename, switch, delete scenarios.
 * Extracted from SovereignHeader.jsx to enforce the 300-line module limit.
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { resetLiveSnapshotBaseline } from '../../domain/finance/live_calc_engine.js';

/**
 * @param {Object}   scenarios  - All scenario objects from store state
 * @param {string}   activeId   - Currently active scenario ID
 * @param {Function} onClose    - Callback to close the dropdown
 */
export const ScenarioManager = ({ scenarios, activeId, onClose }) => {
  const [hoveredScenario,  setHoveredScenario]  = useState(null);
  const [editingScenario,  setEditingScenario]  = useState(null);
  const [newScenarioName,  setNewScenarioName]  = useState('');
  const [deleteConfirm,    setDeleteConfirm]    = useState(null);

  const commitRename = (id) => {
    if (editingScenario && editingScenario.value.trim()) {
      store.renameScenario(id, editingScenario.value);
    }
    setEditingScenario(null);
  };

  const commitCreate = () => {
    if (newScenarioName.trim()) {
      store.createScenario(newScenarioName);
      setNewScenarioName('');
      onClose();
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 12px)',
      right: 0,
      backgroundColor: 'rgba(15, 28, 41, 0.85)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      color: '#fff',
      borderRadius: 12,
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      width: 300,
      zIndex: 1001,
      border: '1px solid rgba(255,255,255,0.1)',
      animation: 'fadeIn 0.2s ease',
      overflow: 'hidden'
    }}>
      {/* Header + Create input */}
      <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>
            SCENARIO ARCHIVE
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newScenarioName}
            onChange={(e) => setNewScenarioName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitCreate()}
            placeholder="New scenario..."
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: '#fff',
              fontSize: '11px',
              padding: '6px 10px',
              outline: 'none'
            }}
          />
          <button
            onClick={commitCreate}
            style={{
              border: 'none',
              backgroundColor: '#fff',
              color: '#000',
              borderRadius: 6,
              width: 30,
              height: 30,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Scenario list */}
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {Object.keys(scenarios).map(id => (
          <div
            key={id}
            onMouseEnter={() => setHoveredScenario(id)}
            onMouseLeave={() => setHoveredScenario(null)}
            style={{
              position: 'relative',
              padding: '12px 16px',
              cursor: 'pointer',
              fontSize: T.fs.xs,
              fontWeight: 500,
              backgroundColor: activeId === id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: activeId === id ? '#fff' : 'rgba(255,255,255,0.6)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.1s ease',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}
            onClick={() => {
              if (!editingScenario) {
                store.setActiveScenario(id);
                resetLiveSnapshotBaseline(id); // reset delta baseline for this scenario
                onClose();
              }
            }}
          >
            {editingScenario?.id === id ? (
              <input
                autoFocus
                value={editingScenario.value}
                onChange={(e) => setEditingScenario({ ...editingScenario, value: e.target.value })}
                onBlur={() => commitRename(id)}
                onKeyDown={(e) => e.key === 'Enter' && commitRename(id)}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid #fff',
                  borderRadius: 3,
                  color: '#fff',
                  fontSize: T.fs.xs,
                  padding: '2px 6px',
                  outline: 'none',
                  width: '100%'
                }}
              />
            ) : (
              <span style={{ flex: 1 }}>{id.toUpperCase().replace(/_/g, ' ')}</span>
            )}

            {hoveredScenario === id && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingScenario({ id, value: id }); }}
                  style={{ border: 'none', background: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }}
                >
                  ✎
                </button>
                {id !== 'default' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(id); }}
                    style={{ border: 'none', background: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }}
                  >
                    ✖
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirmation overlay */}
      {deleteConfirm && (
        <div style={{
          padding: '12px',
          backgroundColor: 'rgba(225, 112, 85, 0.95)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, marginBottom: 10, color: '#fff' }}>
            DELETE SCENARIO?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { store.deleteScenario(deleteConfirm); setDeleteConfirm(null); }}
              style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', backgroundColor: '#fff', color: '#d63030', fontWeight: 'bold', cursor: 'pointer', fontSize: '10px' }}
            >
              YES
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', cursor: 'pointer', fontSize: '10px' }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
