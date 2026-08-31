import { configuredPort } from './server-configuration.js';

describe('configuredPort', () => {
  it('defaults to the API development port', () => {
    expect(configuredPort(undefined)).toBe(3001);
  });

  it.each(['0', '-1', '3001.5', 'named-pipe', '65536'])(
    'rejects invalid port %s',
    (port) => {
      expect(() => configuredPort(port)).toThrow(
        'PORT must be a positive integer',
      );
    },
  );

  it('accepts a valid HTTP port', () => {
    expect(configuredPort('3001')).toBe(3001);
  });
});
