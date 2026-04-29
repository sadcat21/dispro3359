import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole, isCompanyManagerRole } from '@/lib/utils';
import WorkerHome from './WorkerHome';
import AdminHome from './AdminHome';
import CompanyManagerHome from './CompanyManagerHome';
import BranchManagerHome from './BranchManagerHome';

const Index: React.FC = () => {
  const { role, activeRole } = useAuth();

  // Assistant General Manager has its own executive dashboard with a distinct theme
  if (isCompanyManagerRole(activeRole?.custom_role_code)) {
    return <CompanyManagerHome />;
  }

  // Branch Manager — dedicated streamlined dashboard with only allowed features
  if (role === 'branch_admin') {
    return <BranchManagerHome />;
  }

  if (isAdminRole(role)) {
    return <AdminHome />;
  }

  return <WorkerHome />;
};

export default Index;
