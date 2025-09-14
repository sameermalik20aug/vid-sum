import React from 'react';
import './Input.css';

const Input = ({ 
  type = 'text',
  placeholder = '',
  value = '',
  onChange,
  disabled = false,
  className = '',
  ...props 
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`input ${className} ${disabled ? 'disabled' : ''}`}
      {...props}
    />
  );
};

export default Input;