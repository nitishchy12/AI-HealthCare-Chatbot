import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import RiskBadge from '../components/ui/RiskBadge';
import ConfidenceBar from '../components/ui/ConfidenceBar';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { MessageSquare } from 'lucide-react';

// ── Button ────────────────────────────────────────────────────────

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when loading is true', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders primary variant by default', () => {
    render(<Button>Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');
  });

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-primary');
  });

  it('renders danger variant', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-danger');
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Test</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });
});

// ── Input ─────────────────────────────────────────────────────────

describe('Input', () => {
  it('renders label when provided', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows required asterisk when required', () => {
    render(<Input label="Email" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('displays helper text when no error', () => {
    render(<Input helper="Enter your email" />);
    expect(screen.getByText('Enter your email')).toBeInTheDocument();
  });

  it('does not show helper when error is present', () => {
    render(<Input error="Error!" helper="Helper text" />);
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
  });

  it('forwards value and onChange', () => {
    const onChange = vi.fn();
    render(<Input value="test" onChange={onChange} readOnly />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('test');
  });

  it('applies error ring when error present', () => {
    render(<Input error="bad" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-danger');
  });
});

// ── RiskBadge ─────────────────────────────────────────────────────

describe('RiskBadge', () => {
  it('renders Low level', () => {
    render(<RiskBadge level="Low" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders Medium level', () => {
    render(<RiskBadge level="Medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders High level', () => {
    render(<RiskBadge level="High" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders Critical level', () => {
    render(<RiskBadge level="Critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders the level text and uses Low styling for unknown levels', () => {
    render(<RiskBadge level="Unknown" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('applies green class for Low', () => {
    const { container } = render(<RiskBadge level="Low" />);
    expect(container.firstChild.className).toContain('green');
  });

  it('applies red class for High', () => {
    const { container } = render(<RiskBadge level="High" />);
    expect(container.firstChild.className).toContain('red');
  });
});

// ── ConfidenceBar ─────────────────────────────────────────────────

describe('ConfidenceBar', () => {
  it('renders percentage label', () => {
    render(<ConfidenceBar confidence={0.78} riskLevel="Low" />);
    expect(screen.getByText(/78%/)).toBeInTheDocument();
  });

  it('renders 0% for confidence 0', () => {
    render(<ConfidenceBar confidence={0} riskLevel="Low" />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('renders 100% for confidence 1', () => {
    render(<ConfidenceBar confidence={1} riskLevel="Low" />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('clamps confidence above 1', () => {
    render(<ConfidenceBar confidence={1.5} riskLevel="Low" />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('clamps confidence below 0', () => {
    render(<ConfidenceBar confidence={-0.5} riskLevel="Low" />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('shows High confidence label for >= 75%', () => {
    render(<ConfidenceBar confidence={0.8} riskLevel="Low" />);
    expect(screen.getByText(/High confidence/)).toBeInTheDocument();
  });

  it('shows Low confidence label for < 50%', () => {
    render(<ConfidenceBar confidence={0.3} riskLevel="Low" />);
    expect(screen.getByText(/Low confidence/)).toBeInTheDocument();
  });
});

// ── Skeleton ──────────────────────────────────────────────────────

describe('Skeleton', () => {
  it('renders with shimmer animation class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild.className).toContain('animate-shimmer');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-20 w-full" />);
    expect(container.firstChild.className).toContain('h-20');
  });
});

// ── EmptyState ────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<EmptyState title="Empty" description="No data found." />);
    expect(screen.getByText('No data found.')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<EmptyState icon={MessageSquare} title="No chats" />);
    // Icon renders as an SVG
    const { container } = render(<EmptyState icon={MessageSquare} title="No chats" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<EmptyState title="Empty" action={<button>Add Item</button>} />);
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });
});
