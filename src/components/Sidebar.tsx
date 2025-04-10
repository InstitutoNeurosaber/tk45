import React from 'react';
import { Link } from 'react-router-dom';

export const Sidebar = () => {
  return (
    <nav className="sidebar">
      <div className="menu-section">
        <h3>Configurações</h3>
        <ul>
          <li>
            <Link to="/webhooks/email-templates" className="menu-item">
              <span className="icon">✉️</span>
              Templates de Email
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}; 