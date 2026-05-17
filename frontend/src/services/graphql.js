// frontend/src/services/graphql.js
import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { gql } from '@apollo/client';

// Lien HTTP vers l'API Gateway
const httpLink = createHttpLink({
  uri: 'http://localhost:3000/graphql',
});

// Lien d'authentification : ajoute le token JWT dans les en-têtes
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

// Création du client Apollo
const client = new ApolloClient({
  link: from([authLink, httpLink]),  
  cache: new InMemoryCache(),
});

// Export des fragments GraphQL 
export const GET_GAMES = gql`
  query GetGames {
    games {
      id
      name
      averageRating
      categories
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      token
      userId
    }
  }
`;

export const CREATE_GAME_MUTATION = gql`
  mutation CreateGame($name: String!, $description: String!, $rules: String!, $categories: [String!]!) {
    createGame(name: $name, description: $description, rules: $rules, categories: $categories) {
      id
      name
    }
  }
`;

export default client;