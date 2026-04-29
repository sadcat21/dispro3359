import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole, isCompanyManagerRole } from '@/lib/utils';
import WorkerHome from './WorkerHome';
import AdminHome from './AdminHome';
import CompanyManagerHome from './CompanyManagerHome';

const Index: React.FC = () => {
  const { role, activeRole } = useAuth();

  // Company Manager has its own executive dashboard with a distinct theme
  if (isCompanyManagerRole(activeRole?.custom_role_code)) {
    return <CompanyManagerHome />;
  }

  if (isAdminRole(role)) {
    return <AdminHome />;
  }

  return <WorkerHome />;
};

export default Index;
