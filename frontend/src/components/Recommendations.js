import React, { useState } from 'react';
import { recommendations } from '../services/api';

const Recommendations = () => {
  const [userId, setUserId] = useState('');
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRecs = async () => {
    setLoading(true);
    try {
      const res = await recommendations.get(userId);
      let data = res.data;
      if (data && !Array.isArray(data) && data.recommendations) {
        data = data.recommendations;
      }
      
      if (!Array.isArray(data)) {
        data = [];
      }
      setRecs(data);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la récupération des recommandations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gaming-card">
      <h2 className="gaming-title">Recommandations</h2>
      <input className="gaming-input" placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} />
      <button className="gaming-button" onClick={fetchRecs}>Obtenir</button>
      {loading && <p>Chargement...</p>}
      {!loading && recs.length === 0 && <p>Aucune recommandation disponible pour le moment. Terminez des playtests pour générer des recommandations.</p>}
      {recs.map((r, i) => (
        <div key={i} className="kafka-event">{r.name} (score: {r.score})</div>
      ))}
    </div>
  );
};

export default Recommendations;