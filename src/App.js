import React, { Component } from 'react';
import { ApolloProvider, Query } from 'react-apollo';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { RestLink } from 'apollo-link-rest';
import { gql } from 'apollo-boost';
import axios from 'axios';
import logo from './logo.svg';
import './App.css';
import secrets from './.secrets.json';

const camelCase = (str) =>
  str.replace(/[-_]([a-z])/g, (m) => m[1].toUpperCase());

const fetchToken = () =>
  axios.post('oauth/token', {
    client_id: secrets.client_id,
    client_secret: secrets.client_secret,
    grant_type: 'password',
    username: secrets.username,
    password: secrets.password,
  });

const getAccessToken = () => {
  if (JSON.parse(localStorage.getItem('token'))) {
    return new Promise((resolve, reject) => {
      const token = JSON.parse(window.localStorage.getItem('token'));
      resolve(token);
    });
  }

  return new Promise((resolve, reject) => {
    fetchToken().then(({ data }) => {
      resolve(data);
    });
  });
};

const storeAccessToken = (token) => {
  window.localStorage.setItem('token', JSON.stringify(token));

  return token;
};

const removeSavedToken = () => {
  return new Promise((resolve, reject) => {
    window.localStorage.removeItem('token');
    resolve();
  });
};

const accessToken = () =>
  getAccessToken().then((stuff) => {
    return storeAccessToken(stuff);
  });

const authorizeRequest = (options) => {
  return accessToken().then((data) => {
    options.headers.set('X-Crowdlab-Tenant', 'crowdlab');
    options.headers.set('Authorization', `Bearer ${data.access_token}`);
    return options;
  });
};

const customFetch = (endpoint, options) => {
  return authorizeRequest(options)
    .then((authorizedOptions) => {
      return new Promise((resolve, reject) => {
        fetch(endpoint, authorizedOptions)
          .then(function(response) {
            if (response.status !== 200) {
              console.log(
                'Looks like there was a problem. Status Code: ' +
                  response.status
              );

              if (response.status === 401) {
                return removeSavedToken().then(() =>
                  customFetch(endpoint, options)
                );
              }

              reject(response);
            }

            // Examine the text in the response
            response.json().then((data) => {
              const flatData = data[Object.keys(data)[0]];
              const fudgedResponse = new Response(JSON.stringify(flatData), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
              });
              resolve(fudgedResponse);
            });
          })
          .catch(function(err) {
            reject(err);
          });
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

const restLink = new RestLink({
  uri: '/',
  credentials: 'same-origin',
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
  fieldNameNormalizer: camelCase,
  customFetch,
});

const client = new ApolloClient({
  link: restLink,
  cache: new InMemoryCache(),
});

const query = gql`
  query agency {
    agency(id: 1) @rest(type: "Agency", path: "agencies/:id") {
      id
      name

      clients @rest(type: "[Client]", path: "agencies/1/clients") {
        id
        name
      }
    }
  }
`;

class App extends Component {
  render() {
    return (
      <ApolloProvider client={client}>
        <div className="App">
          <header className="App-header">
            <img src={logo} className="App-logo" alt="logo" />
            <h1 className="App-title">Welcome to React with apolloss</h1>
          </header>
          <p className="App-intro">
            To get started, edit <code>src/App.js</code> and save to reload.
          </p>
          <Query query={query}>
            {({ loading, error, data, ...junk }) => {
              if (loading) return <div>Loading...</div>;
              if (error) return <div>Error :(</div>;
              return (
                <div>
                  <div>Id: {data.agency.id}</div>
                  <div>Name: {data.agency.name}</div>
                  <div>
                    Clients:
                    {data.agency.clients.map((c) => (
                      <div key={c.id}>
                        <div>Client Id: {c.id}</div>
                        <div>Client Name: {c.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }}
          </Query>
        </div>
      </ApolloProvider>
    );
  }
}

export default App;
