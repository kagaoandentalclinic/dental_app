import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BackButton({ to, label = 'BACK', className = '' }) {
    return (
        <Link to={to} className={`back-button ${className}`.trim()}>
            <span className="back-button__content">
                <ArrowLeft className="back-button__icon" />
                <span>{label}</span>
            </span>
        </Link>
    );
}
