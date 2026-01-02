module github.com/${{ values.repoUrl | parseRepoUrl | pick('owner') }}/${{ values.name }}

go ${{ values.goVersion }}

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/prometheus/client_golang v1.17.0
	github.com/getsentry/sentry-go v0.25.0
	github.com/lib/pq v1.10.9
	github.com/golang-migrate/migrate/v4 v4.16.2
	github.com/kelseyhightower/envconfig v1.4.0
	go.uber.org/zap v1.26.0
)