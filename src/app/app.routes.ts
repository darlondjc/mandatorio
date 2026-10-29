import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Mandatório',
    loadComponent: () => import('./pages/inicio/inicio-page').then((m) => m.InicioPage),
  },
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
    path: 'votacao/:id',
    title: 'Votação · Mandatório',
    loadComponent: () => import('./pages/votacao/votacao-page').then((m) => m.VotacaoPage),
  },
  {
    path: 'rankings',
    title: 'Rankings · Mandatório',
    loadComponent: () => import('./pages/rankings/rankings-page').then((m) => m.RankingsPage),
  },
  {
    path: 'comparar',
    title: 'Comparar senadores · Mandatório',
    loadComponent: () => import('./pages/comparar/comparar-page').then((m) => m.CompararPage),
  },
  {
    path: 'presidente',
    title: 'Presidente · Mandatório',
    loadComponent: () => import('./pages/presidente/presidente-page').then((m) => m.PresidentePage),
  },
  {
    path: 'presidente/comparar',
    title: 'Comparar mandatos · Mandatório',
    loadComponent: () => import('./pages/mandatos/mandatos-page').then((m) => m.MandatosPage),
  },
  {
    path: 'indicadores',
    title: 'O país em cada mandato · Mandatório',
    loadComponent: () => import('./pages/indicadores/indicadores-page').then((m) => m.IndicadoresPage),
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
