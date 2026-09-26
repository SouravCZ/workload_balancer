import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/ui";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    navigate("/dashboard");
  };

  const signInWithProvider = (provider) => {
    navigate("/dashboard", { state: { signedInWith: provider } });
  };

  return (
    <div className="bg-surface-container-low text-on-surface font-body-md antialiased min-h-screen flex flex-col">
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 w-full max-w-[1440px] mx-auto min-h-screen">
        <div className="hidden lg:flex flex-col justify-center px-margin-tablet xl:px-margin-desktop py-xl relative overflow-hidden bg-surface-container-low/30">
          <div
            className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 10% 20%, #31433b 0%, transparent 40%)",
            }}
          />
          <div className="z-10 max-w-lg">
            <div className="flex items-center gap-md mb-16">
              <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center soft-shadow">
                <Icon name="view_cozy" className="text-on-primary" filled />
              </div>
              <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                Equilibrium
              </span>
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface mb-lg leading-tight">
              Welcome back to
              <br />
              smarter team planning.
            </h1>
            <p className="font-body-md text-body-md text-secondary mb-xl text-lg">
              The AI-powered command center to balance workload, match tasks, and prevent burnout
              before it starts.
            </p>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg soft-shadow relative">
              <div className="flex justify-between items-center mb-lg border-b border-outline-variant/50 pb-md">
                <span className="font-label-md text-label-md text-on-surface">
                  Live Workload Capacity
                </span>
                <Icon name="more_horiz" className="text-secondary" />
              </div>

              <div className="mb-md flex items-center gap-md">
                <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-label-md text-xs">
                  SJ
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between mb-1">
                    <span className="font-body-sm text-body-sm text-on-surface text-xs">
                      Sarah Jenkins
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary text-xs">60%</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary-container w-[60%] rounded-full" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-md relative">
                <div className="w-8 h-8 rounded-full bg-error-container text-on-error-container flex items-center justify-center font-label-md text-xs">
                  MR
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between mb-1">
                    <span className="font-body-sm text-body-sm text-on-surface text-xs">
                      Marcus Reed
                    </span>
                    <span className="font-body-sm text-body-sm text-error text-xs font-medium">
                      95%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-error-container/50 rounded-full overflow-hidden">
                    <div className="h-full bg-error w-[95%] rounded-full" />
                  </div>
                </div>

                <div className="absolute -bottom-10 right-0 lg:-right-8 bg-surface-container-lowest border border-outline-variant rounded-lg p-md lift-shadow flex items-start gap-sm max-w-[240px] z-20">
                  <Icon name="auto_awesome" className="text-primary-container" style={{ fontSize: "16px" }} filled />
                  <div>
                    <span className="block font-label-md text-label-md text-on-surface text-[11px] mb-0.5">
                      Burnout Risk Detected
                    </span>
                    <span className="block font-body-sm text-body-sm text-secondary text-[10px] leading-tight">
                      Reassign 2 backend tasks from Marcus to Sarah to balance capacity.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center items-center px-margin-mobile py-xl lg:px-lg relative bg-surface-container-low">
          <div className="lg:hidden flex items-center gap-sm mb-xl self-start w-full max-w-md mx-auto">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
              <Icon name="view_cozy" className="text-on-primary" filled />
            </div>
            <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              Equilibrium
            </span>
          </div>

          <div className="w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-lg">
            <div className="flex gap-lg border-b border-outline-variant/40 mb-xl">
              {[
                { key: "login", label: "Login" },
                { key: "signup", label: "Create Account" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setMode(tab.key)}
                  className={`font-label-md text-label-md pb-md px-1 transition-colors ${
                    mode === tab.key
                      ? "text-primary-container border-b-2 border-primary-container"
                      : "text-secondary hover:text-on-surface"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form className="flex flex-col gap-lg" onSubmit={submit}>
              {mode === "signup" ? (
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface" htmlFor="name">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Ada Lovelace"
                    className="w-full px-md py-2.5 bg-surface-container-lowest font-body-md text-body-md text-on-surface border border-outline-variant rounded-md focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all placeholder:text-secondary/60"
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface" htmlFor="email">
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="w-full px-md py-2.5 bg-surface-container-lowest font-body-md text-body-md text-on-surface border border-outline-variant rounded-md focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all placeholder:text-secondary/60"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                    className="w-full px-md py-2.5 bg-surface-container-lowest font-body-md text-body-md text-on-surface border border-outline-variant rounded-md focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all placeholder:text-secondary/60 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-md top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface flex items-center justify-center"
                  >
                    <Icon name={showPassword ? "visibility_off" : "visibility"} className="text-[20px]" />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center mt-1">
                <label className="flex items-center gap-sm cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container focus:ring-offset-0 bg-surface-container-lowest"
                  />
                  <span className="font-body-sm text-body-sm text-secondary group-hover:text-on-surface transition-colors">
                    Remember me
                  </span>
                </label>
                <a
                  href="#"
                  className="font-label-md text-label-md text-[13px] text-primary-container hover:text-primary transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              <div className="flex flex-col gap-sm mt-1">
                <button
                  type="submit"
                  className="w-full py-2.5 px-md bg-primary-container text-on-primary font-label-md text-label-md rounded-md hover:bg-primary transition-colors flex items-center justify-center soft-shadow"
                >
                  {mode === "signup" ? "Create Account" : "Sign In"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="w-full py-2.5 px-md bg-surface-container-lowest border border-outline-variant text-on-surface font-label-md text-label-md rounded-md hover:bg-surface transition-colors flex items-center justify-center"
                >
                  Continue as Demo
                </button>
              </div>
            </form>

            <div className="flex items-center gap-md my-xl">
              <div className="h-px bg-outline-variant/40 flex-grow" />
              <span className="font-body-sm text-body-sm text-secondary/70 text-xs uppercase tracking-wider">
                Or continue with
              </span>
              <div className="h-px bg-outline-variant/40 flex-grow" />
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <button
                type="button"
                onClick={() => signInWithProvider("Google")}
                className="flex items-center justify-center gap-sm py-2 px-md border border-outline-variant rounded-md hover:bg-surface transition-colors text-on-surface"
              >
                <svg className="w-4 h-4 opacity-70" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                </svg>
                <span className="font-label-md text-label-md text-[13px]">Google</span>
              </button>
              <button
                type="button"
                onClick={() => signInWithProvider("Microsoft")}
                className="flex items-center justify-center gap-sm py-2 px-md border border-outline-variant rounded-md hover:bg-surface transition-colors text-on-surface"
              >
                <svg className="w-4 h-4 opacity-70" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
                </svg>
                <span className="font-label-md text-label-md text-[13px]">Microsoft</span>
              </button>
            </div>
          </div>

          <div className="mt-xl flex items-center gap-1.5 text-secondary">
            <Icon name="lock" className="text-[16px]" />
            <span className="font-body-sm text-body-sm text-[12px]">
              Your data stays private and secure.
            </span>
          </div>

          <Link
            to="/"
            className="mt-lg font-label-md text-label-md text-primary-container hover:text-primary transition-colors"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
