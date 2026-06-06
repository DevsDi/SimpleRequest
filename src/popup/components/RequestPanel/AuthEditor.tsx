import React from 'react';
import { useStore } from '@/store';
import { AuthType } from '@/types';
import './AuthEditor.scss';

/**
 * Authorization editor component - Postman style
 * Supports: No Auth, API Key, Bearer Token, Basic Auth, OAuth2
 */
const AuthEditor: React.FC = () => {
  const { currentRequest, updateRequest } = useStore();
  const { auth } = currentRequest;

  /** Handle auth type change */
  const handleTypeChange = (type: AuthType) => {
    updateRequest({
      auth: { type }
    });
  };

  /** Update API Key config */
  const updateApiKey = (field: 'key' | 'value' | 'addTo', value: string) => {
    updateRequest({
      auth: {
        ...auth,
        type: 'api-key',
        apiKey: {
          ...auth.apiKey,
          key: auth.apiKey?.key || '',
          value: auth.apiKey?.value || '',
          addTo: auth.apiKey?.addTo || 'header',
          [field]: value
        }
      }
    });
  };

  /** Update Bearer Token */
  const updateBearerToken = (token: string) => {
    updateRequest({
      auth: {
        ...auth,
        type: 'bearer-token',
        bearerToken: { token }
      }
    });
  };

  /** Update Basic Auth */
  const updateBasicAuth = (field: 'username' | 'password', value: string) => {
    updateRequest({
      auth: {
        ...auth,
        type: 'basic-auth',
        basicAuth: {
          ...auth.basicAuth,
          username: auth.basicAuth?.username || '',
          password: auth.basicAuth?.password || '',
          [field]: value
        }
      }
    });
  };

  /** Update OAuth2 */
  const updateOAuth2 = (field: 'accessToken' | 'tokenType', value: string) => {
    updateRequest({
      auth: {
        ...auth,
        type: 'oauth2',
        oauth2: {
          ...auth.oauth2,
          accessToken: auth.oauth2?.accessToken || '',
          tokenType: auth.oauth2?.tokenType || 'Bearer',
          [field]: value
        }
      }
    });
  };

  return (
    <div className="auth-editor">
      {/* Type selector */}
      <div className="auth-type-selector">
        <select value={auth.type} onChange={(e) => handleTypeChange(e.target.value as AuthType)}>
          <option value="no-auth">No Auth</option>
          <option value="api-key">API Key</option>
          <option value="bearer-token">Bearer Token</option>
          <option value="basic-auth">Basic Auth</option>
          <option value="oauth2">OAuth 2.0</option>
        </select>
      </div>

      {/* Config area based on type */}
      <div className="auth-config">
        {auth.type === 'no-auth' && (
          <div className="no-auth-hint">
            This request does not require authentication.
          </div>
        )}

        {auth.type === 'api-key' && (
          <div className="api-key-config">
            <div className="config-row">
              <label>Key</label>
              <input
                type="text"
                placeholder="API Key name"
                value={auth.apiKey?.key || ''}
                onChange={(e) => updateApiKey('key', e.target.value)}
              />
            </div>
            <div className="config-row">
              <label>Value</label>
              <input
                type="text"
                placeholder="API Key value"
                value={auth.apiKey?.value || ''}
                onChange={(e) => updateApiKey('value', e.target.value)}
              />
            </div>
            <div className="config-row">
              <label>Add to</label>
              <select
                value={auth.apiKey?.addTo || 'header'}
                onChange={(e) => updateApiKey('addTo', e.target.value)}
              >
                <option value="header">Header</option>
                <option value="query">Query Params</option>
              </select>
            </div>
          </div>
        )}

        {auth.type === 'bearer-token' && (
          <div className="bearer-config">
            <div className="config-row">
              <label>Token</label>
              <input
                type="text"
                placeholder="Bearer token"
                value={auth.bearerToken?.token || ''}
                onChange={(e) => updateBearerToken(e.target.value)}
              />
            </div>
            <div className="config-hint">
              Token will be added as: Authorization: Bearer {auth.bearerToken?.token || '&lt;token&gt;'}
            </div>
          </div>
        )}

        {auth.type === 'basic-auth' && (
          <div className="basic-config">
            <div className="config-row">
              <label>Username</label>
              <input
                type="text"
                placeholder="Username"
                value={auth.basicAuth?.username || ''}
                onChange={(e) => updateBasicAuth('username', e.target.value)}
              />
            </div>
            <div className="config-row">
              <label>Password</label>
              <input
                type="password"
                placeholder="Password"
                value={auth.basicAuth?.password || ''}
                onChange={(e) => updateBasicAuth('password', e.target.value)}
              />
            </div>
          </div>
        )}

        {auth.type === 'oauth2' && (
          <div className="oauth2-config">
            <div className="config-row">
              <label>Access Token</label>
              <input
                type="text"
                placeholder="Access token"
                value={auth.oauth2?.accessToken || ''}
                onChange={(e) => updateOAuth2('accessToken', e.target.value)}
              />
            </div>
            <div className="config-row">
              <label>Token Type</label>
              <input
                type="text"
                placeholder="Bearer"
                value={auth.oauth2?.tokenType || 'Bearer'}
                onChange={(e) => updateOAuth2('tokenType', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthEditor;