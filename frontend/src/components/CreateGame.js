import React, { useState } from 'react';
import { games } from '../services/api';

const CreateGame = ({ onGameCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [categories, setCategories] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const catArray = categories.split(',').map(c => c.trim());
    await games.create({ name, description, rules, categories: catArray });
    alert('Jeu créé !');
    onGameCreated();
    setName(''); setDescription(''); setRules(''); setCategories('');
  };

  return (
    <div className="gaming-card">
      <h2 className="gaming-title"> Créer un jeu</h2>
      <form onSubmit={handleSubmit}>
        <input className="gaming-input" placeholder="Nom" value={name} onChange={e => setName(e.target.value)} required />
        <textarea className="gaming-textarea" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} required />
        <textarea className="gaming-textarea" placeholder="Règles" value={rules} onChange={e => setRules(e.target.value)} required />
        <input className="gaming-input" placeholder="Catégories (séparées par des virgules)" value={categories} onChange={e => setCategories(e.target.value)} required />
        <button className="gaming-button" type="submit">Créer</button>
      </form>
    </div>
  );
};

export default CreateGame;