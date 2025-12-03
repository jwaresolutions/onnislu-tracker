import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 3,
            bgcolor: 'background.default',
          }}
        >
          <Paper
            sx={{
              p: 4,
              maxWidth: 600,
              textAlign: 'center',
            }}
          >
            <ErrorOutlineIcon
              sx={{
                fontSize: 64,
                color: 'error.main',
                mb: 2,
              }}
            />
            <Typography variant="h5" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              The application encountered an unexpected error. Please try refreshing the page.
            </Typography>
            {this.state.error && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  mb: 3,
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                <Typography variant="caption" component="div" sx={{ fontWeight: 600, mb: 1 }}>
                  Error Details:
                </Typography>
                <Typography variant="caption" component="div">
                  {this.state.error.toString()}
                </Typography>
                {this.state.errorInfo && (
                  <Typography variant="caption" component="div" sx={{ mt: 1, fontSize: '0.75rem' }}>
                    {this.state.errorInfo.componentStack}
                  </Typography>
                )}
              </Box>
            )}
            <Button variant="contained" onClick={this.handleReset}>
              Reload Page
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
