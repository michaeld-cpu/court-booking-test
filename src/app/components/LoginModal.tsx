import React, { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ArrowRight } from 'lucide-react';
import VerificationInput from 'react-verification-input';
import { toast } from '@/app/lib/toast';
import { api } from '../lib/api';
import { LOCAL_VENUE_BANNERS } from '../lib/venueBanner';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (auth: {
    mobileNumber: string;
    token: string;
    name?: string | null;
    user?: { id: number; name: string; email: string | null; role: string | null } | null;
  }) => void;
}

function AuthLegalNotice({
  onNavigate,
  className = 'mt-6 -mb-2',
}: {
  onNavigate: () => void;
  className?: string;
}) {
  return (
    <p className={`${className} text-xs text-gray-600 leading-relaxed`}>
      By continuing, you agree to our
      <br />
      <Link
        to="/terms"
        className="font-semibold hover:text-gray-700"
        onClick={onNavigate}
      >
        Terms
      </Link>{' '}
      and{' '}
      <Link
        to="/privacy"
        className="font-semibold hover:text-gray-700"
        onClick={onNavigate}
      >
        Privacy Policy
      </Link>
      .
    </p>
  )
}

type AuthMode = 'login' | 'register' | 'forgot';
type RegisterStep = 'send' | 'verify';
type ForgotStep = 'send' | 'reset';
type AuthStatus = 'idle' | 'registering' | 'logging-in';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

const getFieldError = (errors: Record<string, string[]>, field: string) => {
  const messages = errors[field];
  if (!messages || messages.length === 0) {
    return null;
  }
  return messages.join(' ');
};

export function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const mobileTypographyClass =
    '!text-lg md:!text-lg lg:!text-lg !font-normal !leading-[1.25] mb-[-1px]';
  const subtleInsetFieldClass =
    '[box-shadow:inset_0_1px_2px_rgba(15,23,42,0.08)]';
  const [mode, setMode] = useState<AuthMode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('send');
  const [forgotStep, setForgotStep] = useState<ForgotStep>('send');
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');

  const [loginMobile, setLoginMobile] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [registerMobile, setRegisterMobile] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [registerPin, setRegisterPin] = useState('');
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPasswordPin, setForgotPasswordPin] = useState('');
  const [loginErrors, setLoginErrors] = useState<Record<string, string[]>>({});
  const [registerErrors, setRegisterErrors] = useState<Record<string, string[]>>({});
  const [forgotErrors, setForgotErrors] = useState<Record<string, string[]>>({});
  const [playerNotFound, setPlayerNotFound] = useState(false);
  const [playerNotFoundMobile, setPlayerNotFoundMobile] = useState('');
  const loginRequestInFlightRef = useRef(false);
  const [authBannerImage, setAuthBannerImage] = useState(
    LOCAL_VENUE_BANNERS[0] ?? '/imgs/banner-1.jpg',
  );

  useEffect(() => {
    if (!isOpen) {
      setMode('login');
      setRegisterStep('send');
      setForgotStep('send');
      setIsLoading(false);
      setAuthStatus('idle');
      setLoginMobile('');
      setLoginPin('');
      setRegisterMobile('');
      setRegisterName('');
      setRegisterCode('');
      setRegisterPin('');
      setForgotMobile('');
      setForgotCode('');
      setForgotPasswordPin('');
      setLoginErrors({});
      setRegisterErrors({});
      setForgotErrors({});
      setPlayerNotFound(false);
      setPlayerNotFoundMobile('');
      loginRequestInFlightRef.current = false;
      return;
    }
    if (LOCAL_VENUE_BANNERS.length > 0) {
      const randomIndex = Math.floor(Math.random() * LOCAL_VENUE_BANNERS.length);
      setAuthBannerImage(LOCAL_VENUE_BANNERS[randomIndex]);
    }
    const storedMobile = localStorage.getItem('courtbook_last_mobile');
    if (storedMobile) {
      setLoginMobile(storedMobile);
      setRegisterMobile(storedMobile);
      setForgotMobile(storedMobile);
    }
  }, [isOpen]);

  const loginPassword = loginPin;
  const registerPassword = registerPin;
  const forgotPassword = forgotPasswordPin;

  const formatMobileNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('63')) {
      return '+' + digits.slice(0, 12);
    }
    if (digits.startsWith('9')) {
      return '+63' + digits.slice(0, 10);
    }
    if (digits.startsWith('0')) {
      return '+63' + digits.slice(1, 11);
    }
    return '+63' + digits.slice(0, 10);
  };

  const isValidPhilippineMobile = (number: string) => /^\+639\d{9}$/.test(number);
  const formatMobileInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };
  const formatDisplayMobile = (value: string) => {
    if (!value) return '09xxxxxxxxx';
    if (value.startsWith('+63')) {
      return `0${value.slice(3)}`;
    }
    return value;
  };
  const getPinInputClassNames = (accent: 'blue' | 'green') => ({
    container: 'flex !w-full justify-between gap-2',
    character: `!flex !h-11 !w-11 !items-center !justify-center !rounded-md !border !border-gray-200/50 !bg-gray-100 !py-0 !text-base !leading-none !font-medium !text-gray-600 ![box-shadow:inset_0_1px_2px_rgba(15,23,42,0.08)] ${subtleInsetFieldClass}`,
    characterInactive: '!text-gray-400',
    characterSelected:
      accent === 'green'
        ? '!ring-1 !ring-green-500 !bg-white !text-gray-800'
        : '!ring-1 !ring-blue-500 !bg-white !text-gray-800',
    characterFilled: '!text-gray-800',
  });

  const handleSendVerification = async () => {
    setRegisterErrors({});
    if (!isValidPhilippineMobile(registerMobile)) {
      toast.error('Invalid mobile number', {
        description: 'Please enter a valid Philippine mobile number (e.g., +639123456789)',
      });
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/register/send-verification', {
        mobile: registerMobile,
        purpose: 'registration',
      });
      setRegisterStep('verify');
      toast.success('Verification code sent', {
        description: `A code has been sent to ${registerMobile}`,
      });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 422) {
        const errors = error.response?.data?.errors ?? {};
        setRegisterErrors(errors);
        const mobileError = Array.isArray(errors.mobile)
          ? errors.mobile[0]
          : null;
        if (mobileError) {
          toast.error('Invalid mobile number', {
            description: String(mobileError),
          });
        }
        return;
      }
      toast.error('Unable to send code', {
        description: getErrorMessage(error, 'Please try again in a moment.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegisterErrors({});
    if (!isValidPhilippineMobile(registerMobile)) {
      toast.error('Invalid mobile number', {
        description: 'Please enter a valid Philippine mobile number (e.g., +639123456789)',
      });
      return;
    }
    if (!registerName.trim() || !registerCode.trim() || !registerPassword) {
      toast.error('Missing details', {
        description: 'Please fill out all registration fields.',
      });
      return;
    }

    setIsLoading(true);
    setAuthStatus('registering');
    try {
      const response = await api.post('/api/register', {
        mobile: registerMobile,
        name: registerName.trim(),
        code: registerCode.trim(),
        password: registerPassword,
      });
      if (!response.data) {
        throw new Error('Registration response missing.');
      }

      setAuthStatus('logging-in');

      const loginResponse = await api.post('/api/auth', {
        mobile: registerMobile,
        password: registerPassword,
      });
      const token =
        loginResponse.data?.token ??
        loginResponse.data?.access_token ??
        loginResponse.data?.data?.token ??
        null;
      const user = loginResponse.data?.user ?? null;
      const name = loginResponse.data?.user?.name ?? loginResponse.data?.name ?? null;

      if (!token) {
        throw new Error('No token returned by server.');
      }

      toast.success('Registration complete', {
        description: 'You are now logged in.',
      });
      localStorage.setItem('courtbook_last_mobile', registerMobile);
      onLoginSuccess({ mobileNumber: registerMobile, token, name, user });
      onClose();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 422) {
        const errors = error.response?.data?.errors ?? {};
        setRegisterErrors(errors);
        const mobileError = Array.isArray(errors.mobile)
          ? errors.mobile[0]
          : null;
        if (mobileError) {
          toast.error('Invalid mobile number', {
            description: String(mobileError),
          });
        }
        return;
      }
      toast.error('Registration failed', {
        description: getErrorMessage(error, 'Please check your code and try again.'),
      });
    } finally {
      setIsLoading(false);
      setAuthStatus('idle');
    }
  };

  const handleSendForgotVerification = async () => {
    setForgotErrors({});
    if (!isValidPhilippineMobile(forgotMobile)) {
      toast.error('Invalid mobile number', {
        description: 'Please enter a valid Philippine mobile number (e.g., +639123456789)',
      });
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/register/send-verification', {
        mobile: forgotMobile,
        purpose: 'resetpassword',
      });
      setForgotStep('reset');
      toast.success('Verification code sent', {
        description: `A code has been sent to ${forgotMobile}`,
      });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 422) {
        const errors = error.response?.data?.errors ?? {};
        setForgotErrors(errors);
        return;
      }
      toast.error('Unable to send code', {
        description: getErrorMessage(error, 'Please try again in a moment.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setForgotErrors({});
    if (!isValidPhilippineMobile(forgotMobile)) {
      toast.error('Invalid mobile number', {
        description: 'Please enter a valid Philippine mobile number (e.g., +639123456789)',
      });
      return;
    }
    if (!forgotCode.trim() || !forgotPassword) {
      toast.error('Missing details', {
        description: 'Please provide verification code and new PIN.',
      });
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        mobile: forgotMobile,
        password: forgotPassword,
        code: forgotCode.trim(),
      });
      toast.success('PIN reset successful', {
        description: 'You can now login with your new PIN.',
      });
      setLoginMobile(forgotMobile);
      setLoginPin('');
      setMode('login');
      setForgotStep('send');
      setForgotCode('');
      setForgotPasswordPin('');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 422) {
        const errors = error.response?.data?.errors ?? {};
        setForgotErrors(errors);
        return;
      }
      toast.error('Unable to reset PIN', {
        description: getErrorMessage(error, 'Please try again in a moment.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (pinOverride?: string) => {
    if (loginRequestInFlightRef.current) {
      return;
    }
    const pinToSubmit = pinOverride ?? loginPassword;
    setLoginErrors({});
    if (!isValidPhilippineMobile(loginMobile)) {
      toast.error('Invalid mobile number', {
        description: 'Please enter a valid Philippine mobile number (e.g., +639123456789)',
      });
      return;
    }
    if (!pinToSubmit) {
      toast.error('Missing PIN', {
        description: 'Please enter your PIN.',
      });
      return;
    }

    loginRequestInFlightRef.current = true;
    setIsLoading(true);
    try {
      const response = await api.post('/api/auth', {
        mobile: loginMobile,
        password: pinToSubmit,
      });
      const token =
        response.data?.token ??
        response.data?.access_token ??
        response.data?.data?.token ??
        null;
      const user = response.data?.user ?? null;
      const name = response.data?.user?.name ?? response.data?.name ?? null;

      if (!token) {
        toast.error('Login failed', {
          description: 'No token returned by server.',
        });
        return;
      }

      toast.success('Login successful!', {
        description: 'Welcome back.',
      });
      localStorage.setItem('courtbook_last_mobile', loginMobile);
      onLoginSuccess({ mobileNumber: loginMobile, token, name, user });
      onClose();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 422) {
        const message = error.response?.data?.message ?? '';
        if (message === 'Player not found') {
          setPlayerNotFoundMobile(loginMobile);
          setPlayerNotFound(true);
          return;
        }
        const errors = error.response?.data?.errors ?? {};
        setLoginErrors(errors);
        return;
      }
      toast.error('Login failed', {
        description: getErrorMessage(error, 'Please check your credentials and try again.'),
      });
    } finally {
      setIsLoading(false);
      loginRequestInFlightRef.current = false;
    }
  };

  const renderAuthBanner = (title: string, subtitle: string) => (
    <div
      className="relative  -mx-6 -mt-8 sm:-mt-10 mb-5 overflow-hidden rounded-none"
      style={{
        backgroundImage: `url(${authBannerImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 to-black/50 backdrop-blur-lg" />
      <div className="relative px-5 py-6 text-center sm:px-6 sm:py-7">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm sm:text-base text-white/85">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[350px] rounded-3xl border-0 overflow-hidden [&>button:last-child]:text-white [&>button:last-child]:opacity-90 [&>button:last-child]:hover:opacity-100 [&>button:last-child]:data-[state=open]:bg-white/10 [&>button:last-child]:data-[state=open]:text-white"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Authentication</DialogTitle>
        {playerNotFound ? (
          <div className="py-3 sm:py-4 text-center space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                Not Registered
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mt-2">
                This mobile number {formatDisplayMobile(playerNotFoundMobile)}{' '}
                is not yet registered.
              </p>
            </div>
            <div className="space-y-4">
              <Button
                onClick={() => {
                  setPlayerNotFound(false)
                  setMode('register')
                  setRegisterStep('send')
                  setRegisterMobile(playerNotFoundMobile)
                }}
                size="lg"
                className="w-full h-11 sm:h-14 text-sm sm:text-lg gap-2 bg-gray-900 hover:bg-gray-800 shadow-md rounded-2xl"
              >
                Register
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPlayerNotFound(false)
                  setMode('login')
                }}
                className="w-full h-11 sm:h-12 text-sm sm:text-base -mb-3"
              >
                Back to login
              </Button>
            </div>
          </div>
        ) : (
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as AuthMode)
              setRegisterStep('send')
              setForgotStep('send')
            }}
            className="space-y-4"
          >
            {/* <TabsList className="w-full">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList> */}

            <TabsContent value="login">
              <form
                className="space-y-4 sm:space-y-6 pt-2 sm:pt-4 pb-0"
                autoComplete="off"
                onSubmit={(event) => event.preventDefault()}
              >
                <div className="sr-only" aria-hidden="true">
                  <input
                    type="text"
                    name="fake-username"
                    autoComplete="username"
                    tabIndex={-1}
                  />
                  <input
                    type="password"
                    name="fake-password"
                    autoComplete="current-password"
                    tabIndex={-1}
                  />
                </div>
                {renderAuthBanner(
                  'Welcome Back',
                  'Login with your mobile number and PIN',
                )}

                <div className="space-y-2 sm:space-y-3">
                  <Label
                    htmlFor="login-mobile"
                    className="text-sm sm:text-base font-medium text-gray-700"
                  >
                    Mobile Number
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3 sm:left-4 flex items-center gap-0.5">
                      <img
                        src="/imgs/icons/ph.png"
                        alt="Philippine flag"
                        className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
                      />
                      <span
                        className={`${mobileTypographyClass} text-gray-600`}
                      >
                        +63
                      </span>
                    </div>
                    <Input
                      id="login-mobile"
                      type="tel"
                      name="login-mobile"
                      autoComplete="off"
                      placeholder=""
                      value={formatMobileInput(loginMobile.replace('+63', ''))}
                      onChange={(e) => {
                        const digits = e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 10)
                        setLoginMobile(formatMobileNumber(digits))
                        setLoginErrors((prev) => ({ ...prev, mobile: [] }))
                      }}
                      className={`h-12 sm:h-14 ${mobileTypographyClass} pl-20 sm:pl-[5.5rem] lg:pl-[5.5rem] pr-3 sm:pr-4 border-0 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ${subtleInsetFieldClass}`}
                    />
                  </div>
                  {getFieldError(loginErrors, 'mobile') && (
                    <p className="text-xs text-red-600 mt-1">
                      {getFieldError(loginErrors, 'mobile')}
                    </p>
                  )}
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="login-pin"
                      className="text-sm sm:text-base font-medium text-gray-700"
                    >
                      PIN
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotMobile(loginMobile || forgotMobile)
                        setForgotStep('send')
                        setForgotCode('')
                        setForgotPasswordPin('')
                        setForgotErrors({})
                        setMode('forgot')
                      }}
                      className="text-xs sm:text-sm font-medium text-gray-500 hover:text-blue-700"
                    >
                      Forgot PIN?
                    </button>
                  </div>
                  <VerificationInput
                    value={loginPin}
                    length={6}
                    validChars="0-9"
                    placeholder=""
                    passwordMode
                    passwordChar="•"
                    onChange={(value) => {
                      setLoginPin(value);
                      setLoginErrors((prev) => ({ ...prev, password: [] }));
                    }}
                    onComplete={(value) => {
                      if (
                        isValidPhilippineMobile(loginMobile) &&
                        !isLoading
                      ) {
                        void handleLogin(value);
                      }
                    }}
                    inputProps={{
                      id: 'login-pin',
                      autoComplete: 'one-time-code',
                      inputMode: 'numeric',
                    }}
                    classNames={getPinInputClassNames('blue')}
                  />
                  {getFieldError(loginErrors, 'password') && (
                    <p className="text-xs text-red-600 mt-1">
                      {getFieldError(loginErrors, 'password')}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => handleLogin()}
                  disabled={
                    isLoading ||
                    !isValidPhilippineMobile(loginMobile) ||
                    !loginPassword
                  }
                  size="lg"
                  className="mt-2 w-full h-11 sm:h-14 text-sm sm:text-lg gap-2 bg-gray-900 hover:bg-gray-800 shadow-md rounded-2xl"
                >
                  {isLoading ? (
                    'Signing in...'
                  ) : (
                    <>
                      Login
                      <ArrowRight className="size-4 sm:size-5" />
                    </>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register')
                      setRegisterStep('send')
                    }}
                    className="inline-flex w-full h-11 sm:h-14 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm sm:text-lg font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    No account yet?&nbsp;<strong>Register</strong>
                  </button>
                  <AuthLegalNotice onNavigate={onClose} />
                </div>
              </form>
            </TabsContent>

            <TabsContent value="forgot">
              <form
                className="space-y-4 sm:space-y-6 py-2 sm:py-4"
                autoComplete="off"
                onSubmit={(event) => event.preventDefault()}
              >
                {renderAuthBanner(
                  'Reset PIN',
                  forgotStep === 'send'
                    ? 'Enter your mobile number to receive a code'
                    : `We sent a code to ${forgotMobile}`,
                )}

                {forgotStep === 'send' ? (
                  <>
                    <div className="space-y-2 sm:space-y-3">
                      <Label
                        htmlFor="forgot-mobile"
                        className="text-sm sm:text-base font-medium text-gray-700"
                      >
                        Mobile Number
                      </Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-3 sm:left-4 flex items-center gap-0.5">
                          <img
                            src="/imgs/icons/ph.png"
                            alt="Philippine flag"
                            className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
                          />
                          <span
                            className={`${mobileTypographyClass} text-gray-600`}
                          >
                            +63
                          </span>
                        </div>
                        <Input
                          id="forgot-mobile"
                          type="tel"
                          name="forgot-mobile"
                          autoComplete="off"
                          placeholder=""
                          value={formatMobileInput(
                            forgotMobile.replace('+63', ''),
                          )}
                          onChange={(e) => {
                            const digits = e.target.value
                              .replace(/\D/g, '')
                              .slice(0, 10)
                            setForgotMobile(formatMobileNumber(digits))
                            setForgotErrors((prev) => ({
                              ...prev,
                              mobile: [],
                            }))
                          }}
                          className={`h-12 sm:h-16 ${mobileTypographyClass} pl-20 sm:pl-[5.5rem] lg:pl-[5.5rem] pr-3 sm:pr-4 border-0 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ${subtleInsetFieldClass}`}
                        />
                      </div>
                      {getFieldError(forgotErrors, 'mobile') && (
                        <p className="text-xs text-red-600 mt-1">
                          {getFieldError(forgotErrors, 'mobile')}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleSendForgotVerification}
                      disabled={
                        isLoading || !isValidPhilippineMobile(forgotMobile)
                      }
                      size="lg"
                      className="mt-2 w-full h-11 sm:h-14 text-sm sm:text-lg gap-2 bg-gray-900 hover:bg-gray-800 shadow-md"
                    >
                      {isLoading ? (
                        'Sending code...'
                      ) : (
                        <>
                          Send Verification
                          <ArrowRight className="size-4 sm:size-5" />
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2 sm:space-y-3">
                      <Label
                        htmlFor="forgot-code"
                        className="text-sm sm:text-base font-medium text-gray-700"
                      >
                        Verification Code
                      </Label>
                      <VerificationInput
                        value={forgotCode}
                        length={6}
                        validChars="0-9"
                        placeholder=""
                        onChange={(value) => {
                          setForgotCode(value);
                          setForgotErrors((prev) => ({ ...prev, code: [] }));
                        }}
                        inputProps={{
                          id: 'forgot-code',
                          autoComplete: 'one-time-code',
                          inputMode: 'numeric',
                        }}
                        classNames={getPinInputClassNames('blue')}
                      />
                      {getFieldError(forgotErrors, 'code') && (
                        <p className="text-xs text-red-600 mt-1">
                          {getFieldError(forgotErrors, 'code')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                      <Label
                        htmlFor="forgot-password-pin"
                        className="text-sm sm:text-base font-medium text-gray-700"
                      >
                        New PIN
                      </Label>
                      <VerificationInput
                        value={forgotPasswordPin}
                        length={6}
                        validChars="0-9"
                        placeholder=""
                        passwordMode
                        passwordChar="•"
                        onChange={(value) => {
                          setForgotPasswordPin(value);
                          setForgotErrors((prev) => ({
                            ...prev,
                            password: [],
                          }));
                        }}
                        inputProps={{
                          id: 'forgot-password-pin',
                          autoComplete: 'one-time-code',
                          inputMode: 'numeric',
                        }}
                        classNames={getPinInputClassNames('blue')}
                      />
                      {getFieldError(forgotErrors, 'password') && (
                        <p className="text-xs text-red-600 mt-1">
                          {getFieldError(forgotErrors, 'password')}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleResetPassword}
                      disabled={
                        isLoading ||
                        !isValidPhilippineMobile(forgotMobile) ||
                        !forgotCode.trim() ||
                        !forgotPassword
                      }
                      size="lg"
                      className="w-full h-11 sm:h-14 text-sm sm:text-lg gap-2 bg-gray-900 hover:bg-gray-800 shadow-md mt-2"
                    >
                      {isLoading ? 'Resetting PIN...' : 'Reset PIN'}
                    </Button>
                    {/* <Button
                      variant="ghost"
                      onClick={() => setForgotStep('send')}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Change Number
                    </Button> */}
                  </>
                )}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="inline-flex w-full h-11 sm:h-14 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm sm:text-lg font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Back to Login
                  </button>
                  <AuthLegalNotice onNavigate={onClose} className="mt-6" />
                </div>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form
                className="space-y-4 sm:space-y-6 py-2 sm:py-4"
                autoComplete="off"
                onSubmit={(event) => event.preventDefault()}
              >
                <div className="sr-only" aria-hidden="true">
                  <input
                    type="text"
                    name="fake-register-username"
                    autoComplete="username"
                    tabIndex={-1}
                  />
                  <input
                    type="password"
                    name="fake-register-password"
                    autoComplete="new-password"
                    tabIndex={-1}
                  />
                </div>
                {renderAuthBanner(
                  'Create Account',
                  registerStep === 'send'
                    ? 'Verify your number to sign up'
                    : `We sent a code to ${registerMobile}`,
                )}

                {registerStep === 'send' ? (
                  <>
                    <div className="space-y-2 sm:space-y-3">
                      <Label
                        htmlFor="register-mobile"
                        className="text-sm sm:text-base font-medium text-gray-700"
                      >
                        Mobile Number
                      </Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-3 sm:left-4 flex items-center gap-0.5">
                          <img
                            src="/imgs/icons/ph.png"
                            alt="Philippine flag"
                            className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
                          />
                          <span
                            className={`${mobileTypographyClass} text-gray-600`}
                          >
                            +63
                          </span>
                        </div>
                        <Input
                          id="register-mobile"
                          type="tel"
                          name="register-mobile"
                          autoComplete="off"
                          placeholder=""
                          value={formatMobileInput(
                            registerMobile.replace('+63', ''),
                          )}
                          onChange={(e) => {
                            const digits = e.target.value
                              .replace(/\D/g, '')
                              .slice(0, 10)
                            setRegisterMobile(formatMobileNumber(digits))
                            setRegisterErrors((prev) => ({
                              ...prev,
                              mobile: [],
                            }))
                          }}
                          className={`h-12 sm:h-16 ${mobileTypographyClass} pl-20 sm:pl-[5.5rem] lg:pl-[5.5rem] pr-3 sm:pr-4 border-0 focus-visible:ring-1 focus-visible:ring-green-500 transition-colors ${subtleInsetFieldClass}`}
                        />
                      </div>
                      {getFieldError(registerErrors, 'mobile') && (
                        <p className="text-xs text-red-600 mt-1">
                          {getFieldError(registerErrors, 'mobile')}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-500">
                        We'll send a verification code to your phone
                      </p>
                    </div>

                    <Button
                      onClick={handleSendVerification}
                      disabled={
                        isLoading || !isValidPhilippineMobile(registerMobile)
                      }
                      size="lg"
                      className="mt-2 w-full h-11 sm:h-14 text-sm sm:text-lg gap-2 bg-gray-900 hover:bg-gray-800 shadow-md"
                    >
                      {isLoading ? (
                        'Sending code...'
                      ) : (
                        <>
                          Send Verification
                          <ArrowRight className="size-4 sm:size-5" />
                        </>
                      )}
                    </Button>
                    <div className="text-center mb-1">
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="inline-flex w-full h-11 sm:h-14 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm sm:text-lg font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Already have an account?&nbsp;<strong>Login</strong>
                      </button>
                      <AuthLegalNotice onNavigate={onClose} />
                    </div>
                  </>
                ) : (
                  <>
                    <Input
                      id="register-mobile-confirm"
                      type="hidden"
                      name="register-mobile-confirm"
                      autoComplete="off"
                      value={registerMobile}
                      readOnly
                      className="h-11 sm:h-14 text-base sm:text-lg border-2 bg-gray-50"
                    />

                    <div className="space-y-2 sm:space-y-3">
                      <Label
                        htmlFor="register-name"
                        className="text-sm sm:text-base font-medium text-gray-700"
                      >
                        Name
                      </Label>
                      <Input
                        id="register-name"
                        type="text"
                        name="register-name"
                        autoComplete="off"
                        placeholder="Your full name"
                        value={registerName}
                        onChange={(e) => {
                          setRegisterName(e.target.value)
                          setRegisterErrors((prev) => ({ ...prev, name: [] }))
                        }}
                        className={`h-11 sm:h-14 text-base sm:text-lg border-0 focus-visible:ring-1 focus-visible:ring-green-500 transition-colors ${subtleInsetFieldClass}`}
                      />
                      {getFieldError(registerErrors, 'name') && (
                        <p className="text-xs text-red-600 mt-1">
                          {getFieldError(registerErrors, 'name')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                      <Label
                        htmlFor="register-code"
                        className="text-sm sm:text-base font-medium text-gray-700"
                      >
                        Verification Code
                      </Label>
                      <VerificationInput
                        value={registerCode}
                        length={6}
                        validChars="0-9"
                        placeholder=""
                        onChange={(value) => {
                          setRegisterCode(value);
                          setRegisterErrors((prev) => ({ ...prev, code: [] }));
                        }}
                        inputProps={{
                          id: 'register-code',
                          autoComplete: 'one-time-code',
                          inputMode: 'numeric',
                        }}
                        classNames={getPinInputClassNames('green')}
                      />
                      {getFieldError(registerErrors, 'code') && (
                        <p className="text-xs text-red-600 mt-1">
                          {getFieldError(registerErrors, 'code')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 sm:space-y-3 -mt-2">
                      <Label
                        htmlFor="register-pin"
                        className="text-sm sm:text-base font-medium text-gray-700"
                      >
                        Login PIN
                      </Label>
                      <VerificationInput
                        value={registerPin}
                        length={6}
                        validChars="0-9"
                        placeholder=""
                        passwordMode
                        passwordChar="•"
                        onChange={(value) => {
                          setRegisterPin(value);
                          setRegisterErrors((prev) => ({
                            ...prev,
                            password: [],
                          }));
                        }}
                        inputProps={{
                          id: 'register-pin',
                          autoComplete: 'one-time-code',
                          inputMode: 'numeric',
                        }}
                        classNames={getPinInputClassNames('green')}
                      />
                      {getFieldError(registerErrors, 'password') && (
                        <p className="text-xs text-red-600 mt-1">
                          {getFieldError(registerErrors, 'password')}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleRegister}
                      disabled={isLoading}
                      size="lg"
                      className="w-full h-11 sm:h-14 text-sm sm:text-lg gap-2 bg-gray-900 hover:bg-gray-800 shadow-md"
                    >
                      {isLoading && authStatus === 'logging-in' ? (
                        'Logging you in...'
                      ) : isLoading ? (
                        'Creating account...'
                      ) : (
                        <>
                          Create Account
                          <ArrowRight className="size-4 sm:size-5" />
                        </>
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="inline-flex w-full h-11 sm:h-14 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm sm:text-lg font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Already have an account? Login
                    </button>

                    <Button
                      variant="ghost"
                      onClick={() => setRegisterStep('send')}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Change Number
                    </Button>
                    <div className="text-center">
                      <AuthLegalNotice onNavigate={onClose} className="mt-0" />
                    </div>
                  </>
                )}
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
