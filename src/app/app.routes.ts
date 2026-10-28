import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'senado' },
  {
    path: 'senado',
    title: 'Senado · Mandatório',
    loadComponent: () => import('./pages/senado/senado-page').then((m) => m.SenadoPage),
  },
  {
    path: 'senado/:codigo',
    title: 'Senador · Mandatório',
    loadComponent: () => import('./pages/senador/senador-page').then((m) => m.SenadorPage),
  },
  {
    path: 'presidente',
    title: 'Presidente · Mandatório',
    loadComponent: () => import('./pages/presidente/presidente-page').then((m) => m.PresidentePage),
  },
  {
    path: 'presidente/:presidenteId/:mandatoId',
    title: 'Presidente · Mandatório',
    loadComponent: () => import('./pages/presidente/presidente-page').then((m) => m.PresidentePage),
  },
  {
    path: '**',
    title: 'Página não encontrada · Mandatório',
    loadComponent: () => import('./pages/nao-encontrada').then((m) => m.NaoEncontradaPage),
  },
];
