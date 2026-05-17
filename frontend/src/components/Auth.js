import React, { useState } from 'react';
import { auth } from '../services/api';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const res = await auth.login({ username, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('userId', res.data.userId);
        onLogin(res.data.token);
        alert('Connecté !');
      } else {
        await auth.register({ username, password, email });
        alert('Inscription réussie, connectez-vous');
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="gaming-card">
      <h2 className="gaming-title">{isLogin ? ' Connexion' : ' Inscription'}</h2>
      <form onSubmit={handleSubmit}>
        <input className="gaming-input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input className="gaming-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        {!isLogin && <input className="gaming-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />}
        <button className="gaming-button" type="submit">{isLogin ? 'Se connecter' : 'S\'inscrire'}</button>
        <button className="gaming-button" type="button" onClick={() => setIsLogin(!isLogin)} style={{ marginLeft: '10px' }}>
          {isLogin ? 'Créer un compte' : 'Déjà inscrit ?'}
        </button>
      </form>
    </div>
  );
};

export default Auth;