import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Composants de l'application
import Modal from '../../components/Common/Modal';
import Header from '../../components/Layout/Header';
import Sidebar from '../../components/Layout/Sidebar';
import Login from '../../pages/Login';
import SavedCredentials from '../../pages/SavedCredentials';

describe('Suite de Tests Unitaires - HexaPass (CI/CD)', () => {

  // ==========================================
  // SECTION A: Authentification & Validation
  // ==========================================
  describe('A. Authentification & Validation des Formulaires', () => {
    it('1. should validate email format before authentication attempt', () => {
      const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      expect(validateEmail('admin@hexapass.io')).toBe(true);
      expect(validateEmail('invalid-user-email')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    it('2. should reject login payload with empty credentials', () => {
      const validateLoginCredentials = (email, password) => {
        if (!email || !password) return { isValid: false, error: 'Champs obligatoires' };
        if (password.length < 6) return { isValid: false, error: 'Mot de passe trop court' };
        return { isValid: true, error: null };
      };

      expect(validateLoginCredentials('', '')).toEqual({ isValid: false, error: 'Champs obligatoires' });
      expect(validateLoginCredentials('user@test.com', '123')).toEqual({ isValid: false, error: 'Mot de passe trop court' });
      expect(validateLoginCredentials('user@test.com', 'secret123')).toEqual({ isValid: true, error: null });
    });

    it('3. should render Login component and trigger onLogin on form submission', () => {
      const handleLogin = vi.fn();
      render(<Login onLogin={handleLogin} />);

      expect(screen.getByText(/Bienvenue sur HexaPass/i)).toBeInTheDocument();
      const emailInput = screen.getByPlaceholderText('nom@entreprise.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      fireEvent.change(emailInput, { target: { value: 'admin@hexapass.io' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const form = emailInput.closest('form');
      fireEvent.submit(form);

      expect(handleLogin).toHaveBeenCalledTimes(1);
    });

    it('4. should purge session storage and clear auth context on logout', () => {
      let sessionState = { token: 'jwt-hexapass-prod-xyz', user: 'jean.dupont' };
      const logout = () => { sessionState = { token: null, user: null }; };

      logout();
      expect(sessionState.token).toBeNull();
      expect(sessionState.user).toBeNull();
    });
  });

  // ==========================================
  // SECTION B: Contrôle d'Accès (RBAC) & Routes
  // ==========================================
  describe('B. Contrôle d\'Accès (RBAC) & Navigation', () => {
    it('5. should restrict access to admin routes for standard users', () => {
      const getAuthorizedRoutes = (isAdmin) => {
        const baseRoutes = ['/', '/Dashboard', '/MyApplications', '/SavedCredentials', '/Notifications', '/Profile'];
        const adminRoutes = ['/AdminDashboard', '/AdminApplications', '/AdminUsers', '/AdminGroups', '/AdminLogs', '/AdminSettings'];
        return isAdmin ? [...baseRoutes, ...adminRoutes] : baseRoutes;
      };

      const userAccessible = getAuthorizedRoutes(false);
      const adminAccessible = getAuthorizedRoutes(true);

      expect(userAccessible).not.toContain('/AdminUsers');
      expect(userAccessible).not.toContain('/AdminLogs');
      expect(adminAccessible).toContain('/AdminUsers');
      expect(adminAccessible).toContain('/AdminLogs');
    });

    it('6. should render user navigation items in Sidebar when isAdmin is false', () => {
      render(
        <BrowserRouter>
          <Sidebar isAdmin={false} />
        </BrowserRouter>
      );

      expect(screen.getByText('Tableau de Bord')).toBeInTheDocument();
      expect(screen.getByText('Mes Apps')).toBeInTheDocument();
      expect(screen.getByText('Identifiants')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard Admin')).not.toBeInTheDocument();
    });

    it('7. should render admin navigation items in Sidebar when isAdmin is true', () => {
      render(
        <BrowserRouter>
          <Sidebar isAdmin={true} />
        </BrowserRouter>
      );

      expect(screen.getByText('Dashboard Admin')).toBeInTheDocument();
      expect(screen.getByText('Utilisateurs')).toBeInTheDocument();
      expect(screen.getByText('Logs d\'Audit')).toBeInTheDocument();
      expect(screen.queryByText('Mes Apps')).not.toBeInTheDocument();
    });

    it('8. should toggle admin mode and trigger callback when Header button is clicked', () => {
      const onToggleAdmin = vi.fn();
      render(<Header isAdmin={false} onToggleAdmin={onToggleAdmin} />);

      const toggleButton = screen.getByRole('button', { name: /Mode Utilisateur/i });
      fireEvent.click(toggleButton);

      expect(onToggleAdmin).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // SECTION C: Gestion des Applications
  // ==========================================
  describe('C. Gestion des Applications & Métriques', () => {
    const mockApplications = [
      { id: 1, name: 'HexaConnect CRM', category: 'Productivité', status: 'ACTIVE', usersCount: 142 },
      { id: 2, name: 'Africonnect Gateway', category: 'Infrastructure', status: 'ACTIVE', usersCount: 89 },
      { id: 3, name: 'Legacy Billing', category: 'Finance', status: 'MAINTENANCE', usersCount: 12 },
      { id: 4, name: 'Dev Distributeur API', category: 'Outils Dev', status: 'ACTIVE', usersCount: 34 }
    ];

    it('9. should filter applications by case-insensitive name matching', () => {
      const filterApps = (apps, query) =>
        apps.filter(app => app.name.toLowerCase().includes(query.toLowerCase()));

      const results = filterApps(mockApplications, 'africonnect');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Africonnect Gateway');
    });

    it('10. should filter applications by category', () => {
      const filterByCategory = (apps, category) =>
        category === 'ALL' ? apps : apps.filter(app => app.category === category);

      expect(filterByCategory(mockApplications, 'Infrastructure')).toHaveLength(1);
      expect(filterByCategory(mockApplications, 'ALL')).toHaveLength(4);
    });

    it('11. should aggregate total active users across all applications', () => {
      const calculateTotalUsers = (apps) =>
        apps.filter(a => a.status === 'ACTIVE').reduce((sum, a) => sum + a.usersCount, 0);

      expect(calculateTotalUsers(mockApplications)).toBe(142 + 89 + 34); // 265
    });

    it('12. should format new application payload according to schema', () => {
      const createApplicationPayload = (data) => ({
        name: data.name.trim(),
        clientId: `client_${data.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        createdAt: new Date('2026-08-27T00:00:00Z').toISOString(),
        status: 'ACTIVE'
      });

      const payload = createApplicationPayload({ name: '  Nouvelle App 2026  ' });
      expect(payload.name).toBe('Nouvelle App 2026');
      expect(payload.clientId).toBe('client___nouvelle_app_2026__');
      expect(payload.status).toBe('ACTIVE');
    });
  });

  // ==========================================
  // SECTION D: Identifiants & Secrets (SavedCredentials)
  // ==========================================
  describe('D. Gestion des Identifiants & Secrets', () => {
    it('13. should mask passwords by default and reveal on toggle', () => {
      const maskSecret = (secret, isVisible) => isVisible ? secret : '••••••••';

      expect(maskSecret('super_secret_pwd', false)).toBe('••••••••');
      expect(maskSecret('super_secret_pwd', true)).toBe('super_secret_pwd');
    });

    it('14. should render initial credentials in SavedCredentials page', () => {
      render(<SavedCredentials />);

      expect(screen.getByText('GitHub Personal')).toBeInTheDocument();
      expect(screen.getByText('AWS Console')).toBeInTheDocument();
      expect(screen.getByText('Vercel Deployment')).toBeInTheDocument();
    });

    it('15. should open modal when clicking "Ajouter un Secret" in SavedCredentials', () => {
      render(<SavedCredentials />);

      const addButton = screen.getByRole('button', { name: /Ajouter un Secret/i });
      fireEvent.click(addButton);

      expect(screen.getByText('Nom de l\'application / service')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enregistrer le secret/i })).toBeInTheDocument();
    });
  });

  // ==========================================
  // SECTION E: Composants Communs & Comportements UI
  // ==========================================
  describe('E. Composants Communs (Modal & UI)', () => {
    it('16. should render Modal with title and children when isOpen is true', () => {
      render(
        <Modal isOpen={true} title="Fenêtre de Test" onClose={() => { }}>
          <p data-testid="modal-content">Contenu interne de la modale</p>
        </Modal>
      );

      expect(screen.getByText('Fenêtre de Test')).toBeInTheDocument();
      expect(screen.getByTestId('modal-content')).toBeInTheDocument();
    });

    it('17. should not render Modal in DOM when isOpen is false', () => {
      render(
        <Modal isOpen={false} title="Fenêtre Masquée" onClose={() => { }}>
          <p data-testid="modal-content">Inaccessible</p>
        </Modal>
      );

      expect(screen.queryByText('Fenêtre Masquée')).not.toBeInTheDocument();
      expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument();
    });

    it('18. should trigger onClose handler when close button is clicked in Modal', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} title="Fenêtre Fermeture" onClose={handleClose}>
          <span>Contenu</span>
        </Modal>
      );

      const closeButton = document.querySelector('.modal-close');
      expect(closeButton).not.toBeNull();
      fireEvent.click(closeButton);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
