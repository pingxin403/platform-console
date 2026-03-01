/**
 * NPS Survey Card Component
 * 
 * Displays a Net Promoter Score survey to collect developer feedback
 * about the platform experience.
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Chip,
  Grid,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import SentimentVeryDissatisfiedIcon from '@material-ui/icons/SentimentVeryDissatisfied';
import SentimentDissatisfiedIcon from '@material-ui/icons/SentimentDissatisfied';
import SentimentSatisfiedIcon from '@material-ui/icons/SentimentSatisfied';
import SentimentSatisfiedAltIcon from '@material-ui/icons/SentimentSatisfiedAlt';
import SentimentVerySatisfiedIcon from '@material-ui/icons/SentimentVerySatisfied';
import { useApi, configApiRef, identityApiRef } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  card: {
    marginBottom: theme.spacing(2),
  },
  scoreButton: {
    minWidth: '48px',
    height: '48px',
    margin: theme.spacing(0.5),
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    '&:hover': {
      transform: 'scale(1.1)',
    },
  },
  selectedScore: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  detractorScore: {
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
  },
  passiveScore: {
    borderColor: theme.palette.warning.main,
    color: theme.palette.warning.main,
  },
  promoterScore: {
    borderColor: theme.palette.success.main,
    color: theme.palette.success.main,
  },
  scaleLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  commentField: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  categorySelect: {
    marginBottom: theme.spacing(2),
  },
  submitButton: {
    marginTop: theme.spacing(2),
  },
  thankYouMessage: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  icon: {
    fontSize: '64px',
    marginBottom: theme.spacing(2),
  },
}));

interface NPSSurveyCardProps {
  onSubmit?: (score: number, comment?: string, category?: string) => void;
  autoShow?: boolean;
}

export const NPSSurveyCard: React.FC<NPSSurveyCardProps> = ({ onSubmit, autoShow = false }) => {
  const classes = useStyles();
  const configApi = useApi(configApiRef);
  const identityApi = useApi(identityApiRef);

  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligible, setEligible] = useState(true);
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null);

  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    if (autoShow) {
      checkEligibility();
    }
  }, [autoShow]);

  const checkEligibility = async () => {
    try {
      const identity = await identityApi.getBackstageIdentity();
      const userId = identity.userEntityRef;

      const response = await fetch(`${backendUrl}/api/dora/nps/eligibility/${encodeURIComponent(userId)}`);
      const data = await response.json();

      if (!data.eligible) {
        setEligible(false);
        setEligibilityMessage(data.reason || 'You are not eligible for the survey at this time.');
      }
    } catch (err) {
      console.error('Failed to check survey eligibility:', err);
    }
  };

  const handleScoreClick = (selectedScore: number) => {
    setScore(selectedScore);
    setError(null);
  };

  const handleSubmit = async () => {
    if (score === null) {
      setError('Please select a score before submitting.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const identity = await identityApi.getBackstageIdentity();
      const profile = await identityApi.getProfileInfo();

      const userId = identity.userEntityRef;
      const userName = profile.displayName || 'Unknown';
      const email = profile.email || 'unknown@example.com';

      const response = await fetch(`${backendUrl}/api/dora/nps/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userName,
          email,
          score,
          comment: comment.trim() || undefined,
          category: category || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
        if (onSubmit) {
          onSubmit(score, comment, category);
        }
      } else {
        setError(data.error || 'Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      console.error('Failed to submit NPS feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreClassName = (scoreValue: number) => {
    if (scoreValue <= 6) return classes.detractorScore;
    if (scoreValue <= 8) return classes.passiveScore;
    return classes.promoterScore;
  };

  const getThankYouIcon = () => {
    if (score === null) return null;
    if (score <= 4) return <SentimentVeryDissatisfiedIcon className={classes.icon} color="error" />;
    if (score <= 6) return <SentimentDissatisfiedIcon className={classes.icon} color="error" />;
    if (score <= 8) return <SentimentSatisfiedIcon className={classes.icon} style={{ color: '#ff9800' }} />;
    if (score === 9) return <SentimentSatisfiedAltIcon className={classes.icon} color="primary" />;
    return <SentimentVerySatisfiedIcon className={classes.icon} style={{ color: '#4caf50' }} />;
  };

  if (!autoShow && !eligible) {
    return null;
  }

  if (!eligible && eligibilityMessage) {
    return (
      <Card className={classes.card}>
        <CardContent>
          <Alert severity="info">{eligibilityMessage}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className={classes.card}>
        <CardContent>
          <Box className={classes.thankYouMessage}>
            {getThankYouIcon()}
            <Typography variant="h5" gutterBottom>
              Thank you for your feedback!
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Your input helps us improve the platform for everyone.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={classes.card}>
      <CardHeader
        title="How likely are you to recommend this platform to a colleague?"
        subheader="Your feedback helps us improve the developer experience"
      />
      <CardContent>
        {error && (
          <Alert severity="error" style={{ marginBottom: 16 }}>
            {error}
          </Alert>
        )}

        <Box>
          <Typography variant="body2" gutterBottom>
            Select a score from 0 (Not at all likely) to 10 (Extremely likely)
          </Typography>

          <Box display="flex" justifyContent="center" flexWrap="wrap" my={2}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(scoreValue => (
              <Button
                key={scoreValue}
                variant={score === scoreValue ? 'contained' : 'outlined'}
                className={`${classes.scoreButton} ${
                  score === scoreValue ? classes.selectedScore : getScoreClassName(scoreValue)
                }`}
                onClick={() => handleScoreClick(scoreValue)}
                disabled={loading}
              >
                {scoreValue}
              </Button>
            ))}
          </Box>

          <Box className={classes.scaleLabel}>
            <Typography variant="caption" color="textSecondary">
              Not at all likely
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Extremely likely
            </Typography>
          </Box>

          {score !== null && (
            <Box mt={2}>
              <Grid container spacing={2} alignItems="center">
                <Grid item>
                  <Chip
                    label={
                      score >= 9
                        ? 'Promoter 🎉'
                        : score >= 7
                        ? 'Passive 😐'
                        : 'Detractor 😞'
                    }
                    color={score >= 9 ? 'primary' : score >= 7 ? 'default' : 'secondary'}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          <TextField
            className={classes.commentField}
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            label="What's the main reason for your score? (Optional)"
            placeholder="Tell us what you love or what we could improve..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            disabled={loading}
          />

          <FormControl fullWidth variant="outlined" className={classes.categorySelect}>
            <InputLabel>Category (Optional)</InputLabel>
            <Select
              value={category}
              onChange={e => setCategory(e.target.value as string)}
              label="Category (Optional)"
              disabled={loading}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              <MenuItem value="service_catalog">Service Catalog</MenuItem>
              <MenuItem value="golden_paths">Golden Paths / Templates</MenuItem>
              <MenuItem value="deployment">Deployment</MenuItem>
              <MenuItem value="observability">Observability</MenuItem>
              <MenuItem value="cost_management">Cost Management</MenuItem>
              <MenuItem value="documentation">Documentation</MenuItem>
              <MenuItem value="performance">Performance</MenuItem>
              <MenuItem value="ease_of_use">Ease of Use</MenuItem>
              <MenuItem value="support">Support</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          <Button
            className={classes.submitButton}
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            onClick={handleSubmit}
            disabled={loading || score === null}
          >
            {loading ? <CircularProgress size={24} /> : 'Submit Feedback'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
