import React, { useState } from 'react';
import { ApolloProvider } from '@apollo/client/react';
import client from './services/graphql';
import Auth from './components/Auth';
import GameList from './components/GameList';
import CreateGame from './components/CreateGame';
import Playtest from './components/Playtest';
import Recommendations from './components/Recommendations';
import KafkaEvents from './components/KafkaEvents';
import GraphQLDemo from './components/GraphQLDemo';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  return (
    <ApolloProvider client={client}>
      <div className="gaming-container">
        <h1 style={{ textAlign: 'center', color: '#ffd966' }}>BOARD GAME FORGE</h1>
        {!token ? (
          <Auth onLogin={setToken} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              <div>
                <CreateGame onGameCreated={() => window.location.reload()} />
                <GameList />
                <Playtest />
                <Recommendations />
              </div>
              <div>
                <KafkaEvents />
                <GraphQLDemo />
              </div>
            </div>
            <button className="gaming-button" onClick={() => { localStorage.removeItem('token'); setToken(null); }} style={{ marginTop: '20px' }}>Déconnexion</button>
          </>
        )}
      </div>
    </ApolloProvider>
  );
}

export default App;