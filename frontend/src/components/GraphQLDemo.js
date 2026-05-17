import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_GAMES, LOGIN_MUTATION, CREATE_GAME_MUTATION } from '../services/graphql';
import client from '../services/graphql';

const GraphQLDemo = () => {
  const { data: gamesData, refetch } = useQuery(GET_GAMES);
  const [loginMut] = useMutation(LOGIN_MUTATION);
  const [createGameMut] = useMutation(CREATE_GAME_MUTATION);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gameName, setGameName] = useState('');
  const [categories, setCategories] = useState('');

  const handleLogin = async () => {
    const res = await loginMut({ variables: { username, password } });
    localStorage.setItem('token', res.data.login.token);
    client.setLink(client.link); // mettre à jour le token
    alert('Connecté via GraphQL');
  };

  const handleCreateGame = async () => {
    const catArray = categories.split(',').map(c => c.trim());
    await createGameMut({ variables: { name: gameName, description: 'test', rules: '...', categories: catArray } });
    refetch();
    alert('Jeu créé via GraphQL');
  };

  return (
    <div className="gaming-card">
      <h2 className="gaming-title">GraphQL Demo</h2>
      <div>
        <h3>Login</h3>
        <input placeholder="Username" onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
        <button onClick={handleLogin}>Login</button>
      </div>
      <div>
        <h3>Créer un jeu</h3>
        <input placeholder="Nom" onChange={e => setGameName(e.target.value)} />
        <input placeholder="Catégories (virgules)" onChange={e => setCategories(e.target.value)} />
        <button onClick={handleCreateGame}>Créer</button>
      </div>
      <div>
        <h3>Liste des jeux (GraphQL)</h3>
        {gamesData?.games?.map(g => <div key={g.id}>{g.name} - {g.averageRating}</div>)}
      </div>
    </div>
  );
};

export default GraphQLDemo;