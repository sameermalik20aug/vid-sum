import React from 'react';
import './Alert.css';

const Alert = ({ 
  children, 
  variant = 'info',
  className = '',
  ...props 
}) => {
  return (
    <div 
      className={`alert alert-${variant} ${className}`} 
      role="alert"
      {...props}
    >
      {children}
    </div>
  );
};

export default Alert;