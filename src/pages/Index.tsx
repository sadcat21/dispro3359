import React, { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole, isCompanyManagerRole, isInternalSupervisorRole } from '@/lib/utils';

const WorkerHome = lazy(() => import('./WorkerHome'));
const AdminHome = lazy(() => import('./AdminHome'));
const CompanyManagerHome = lazy(() => import('./CompanyManagerHome'));
const InternalSupervisorHome = lazy(() => import('./InternalSupervisorHome'));
const BranchManagerHome = lazy(() => import('./BranchManagerHome'));
const AssistantManagerHome = lazy(() => import('./AssistantManagerHome'));

const Index: React.FC = () => {
  const { role, activeRole } = useAuth();

  // Assistant General Manager has its own executive dashboard with a distinct theme
  if (isCompanyManagerRole(activeRole?.custom_role_code)) {
    return <Suspense fallback={null}><CompanyManagerHome /></Suspense>;
  }

  // Internal Supervisor — branch-scoped staff discipline & monitoring dashboard
  if (isInternalSupervisorRole(activeRole?.custom_role_code)) {
    return <Suspense fallback={null}><InternalSupervisorHome /></Suspense>;
  }

  // Branch Manager — dedicated streamlined dashboard with only allowed features
  if (role === 'branch_admin') {
    return <Suspense fallback={null}><BranchManagerHome /></Suspense>;
  }

  // Assistant Manager — same layout as Branch Manager with red identity
  if (role === 'admin_assistant') {
    return <Suspense fallback={null}><AssistantManagerHome /></Suspense>;
  }

  if (isAdminRole(role)) {
    return <Suspense fallback={null}><AdminHome /></Suspense>;
  }

  return <Suspense fallback={null}><WorkerHome /></Suspense>;
};

export default Index;
