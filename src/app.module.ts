import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { Module, UnauthorizedException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { jwtDecode } from 'jwt-decode';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { v4 as uuidv4 } from 'uuid';
import { WinstonModule, utilities } from 'nest-winston';
import winston from 'winston';
import logger from './logger';
import { GraphQLError } from 'graphql';
const getToken = (authToken: string): string => {
  const match = authToken.match(/^Bearer (.*)$/);
  if (!match || match.length < 2) {
    throw new UnauthorizedException();
  }
  return match[1];
};
const decodeToken = (tokenString: string) => {
  const decoded = jwtDecode(tokenString);
  if (!decoded) {
    throw new UnauthorizedException();
  }
  return decoded;
};

const handleAuth = (req) => {
  try {
    if (req?.headers?.authorization) {
      const token = getToken(req.headers.authorization);
      const decoded: any = decodeToken(token);
      console.log(decoded);
      return {
        userId: decoded.userId,
        role: decoded.role,
        services: decoded.services,
        authorization: `${req.headers.authorization}`,
      };
    }
  } catch (err) {
    throw new GraphQLError(
      'User unauthorized with invalid authorization Headers',
      {
        extensions: {
          code: 'UNAUTHENTICATED',
        },
      },
    );
  }
};

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WinstonModule.forRoot({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            utilities.format.nestLike('MONO', {
              colors: true,
              prettyPrint: true,
              processId: true,
              appName: true,
            }),
          ),
        }),
        new winston.transports.File({ filename: 'logs/app.json' }),
      ],
    }),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      inject: [ConfigService],
      driver: ApolloGatewayDriver,
      useFactory: (config: ConfigService) => ({
        server: {
          context: handleAuth,
          cros: true,
          playground: false,
          plugins: [ApolloServerPluginLandingPageLocalDefault()],
          formatError: (formatError, error) => {
            const uuid = uuidv4();
            logger.error({ ...formatError, uuid });
            if (formatError?.extensions?.code === 'UNAUTHENTICATED') {
              return {
                message: formatError.message,
                path: [uuid],
                extensions: { code: 'UNAUTHENTICATED' },
                serviceName: '',
              };
            }
            if (formatError?.extensions?.originalError) {
              return {
                message: formatError.message,
                path: [uuid],
                originalError: formatError?.extensions?.originalError,
                serviceName: '',
              };
            }
            if (formatError?.extensions?.code === 'INTERNAL_SERVER_ERROR') {
              const message = `Lỗi truy cập, vui lòng liên hệ admin dể được giải đáp`;
              return {
                message,
                path: [uuid],
                originalError: {},
                serviceName: '',
              };
            }

            return formatError;
          },
        },
        gateway: {
          pollIntervalInMs: 30000,
          buildService: ({ name, url }) => {
            return new RemoteGraphQLDataSource({
              url,
              willSendRequest({ request, context }: any) {
                request.http.headers.set('userId', context.userId);
                // for now pass authorization also
                request.http.headers.set(
                  'authorization',
                  context.authorization,
                );

                request.http.headers.set('services', context.services);
                request.http.headers.set('role', context.role);
                request.http.headers.set(
                  'x-security',
                  config.get<string>('SECURIRY'),
                );
              },
            });
          },
          supergraphSdl: new IntrospectAndCompose({
            subgraphHealthCheck: true,
            subgraphs: [
              { name: 'users', url: config.get<string>('USER_SVL') },
              { name: 'auth', url: config.get<string>('AUTH_SVL') },
              { name: 'settings', url: config.get<string>('SETTING_SVL') },
              { name: 'chat', url: config.get<string>('CHAT_SVL') },
            ],
          }),
        },
      }),
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
