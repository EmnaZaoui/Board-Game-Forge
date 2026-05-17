import React, { useEffect, useState } from 'react';
import { games } from '../services/api';

const GameList = () => {
  const [gameList, setGameList] = useState([]);

  const fetchGames = async () => {
    const res = await games.list();
    setGameList(res.data);
  };

  useEffect(() => { fetchGames(); }, []);

  const deleteGame = async (id) => {
    await games.delete(id);
    fetchGames();
  };

  return (
    <div className="gaming-card">
      <h2 className="gaming-title">Liste des jeux</h2>
      {gameList.map(g => (
        <div key={g.id} style={{ borderBottom: '1px solid #ffd966', marginBottom: '10px', padding: '5px' }}>
          <strong>{g.name}</strong> - {g.categories?.join(', ')} (⭐ {g.averageRating || 0})
          <button className="gaming-button" onClick={() => deleteGame(g.id)} style={{ float: 'right' }}>🗑️</button>
        </div>
      ))}
      <button className="gaming-button" onClick={fetchGames}>Rafraîchir</button>
    </div>
  );
};

export default GameList;