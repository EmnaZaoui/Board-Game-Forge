import React, { useState } from 'react';
import { playtest } from '../services/api';

const Playtest = () => {
  const [gameId, setGameId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [moveJson, setMoveJson] = useState('');
  const [score, setScore] = useState('');

  const start = async () => {
    const res = await playtest.start(gameId);
    setSessionId(res.data.id);
    alert(`Session démarrée : ${res.data.id}`);
  };

  const submitMove = async () => {
    await playtest.move(sessionId, moveJson);
    alert('Coup envoyé');
  };

  const complete = async () => {
    await playtest.complete(sessionId, parseInt(score));
    alert('Playtest terminé !');
  };

  return (
    <div className="gaming-card">
      <h2 className="gaming-title">Playtest</h2>
      <input className="gaming-input" placeholder="Game ID" value={gameId} onChange={e => setGameId(e.target.value)} />
      <button className="gaming-button" onClick={start}>Démarrer</button>
      <hr />
      <input className="gaming-input" placeholder="Session ID" value={sessionId} onChange={e => setSessionId(e.target.value)} />
      <textarea
  className="gaming-textarea"
  placeholder='Move JSON (ex: {"action":"roll"})'
  value={moveJson}
  onChange={e => setMoveJson(e.target.value)}
/>
      <button className="gaming-button" onClick={submitMove}>Envoyer coup</button>
      <hr />
      <input className="gaming-input" placeholder="Score final" value={score} onChange={e => setScore(e.target.value)} />
      <button className="gaming-button" onClick={complete}>Terminer</button>
    </div>
  );
};

export default Playtest;